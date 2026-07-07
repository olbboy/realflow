import type { Edge, Node, XY } from './types';
import type { FlowStore } from './store';
import { layout as runLayout, type LayoutDirection, type LayoutType } from './layout';
import { uid } from './utils';

/**
 * The AI-agent integration layer.
 *
 * FlowOperation is a compact, JSON-serializable command format designed to
 * be emitted by LLM tool calls (or any remote agent) and applied to a live
 * canvas. The executor is:
 *
 *  - validated     — malformed / impossible ops are collected as errors,
 *                    never thrown, and never corrupt the graph
 *  - transactional — one agent turn = one undo entry (⌘Z reverts it all)
 *  - layout-aware  — nodes without positions are auto-laid-out
 *  - streaming     — apply ops one-by-one as they arrive, or as a batch
 */

export type FlowOperation =
  | {
      op: 'add_node';
      id?: string;
      /** Node type key (registered in nodeTypes). */
      type?: string;
      /** Shorthand for data.label. */
      label?: string;
      data?: Record<string, unknown>;
      /** Omit to auto-layout after the batch. */
      position?: XY;
      parentId?: string;
      width?: number;
      height?: number;
    }
  | {
      op: 'update_node';
      id: string;
      label?: string;
      /** Merged into existing data. */
      data?: Record<string, unknown>;
      position?: XY;
      type?: string;
    }
  | { op: 'remove_node'; id: string }
  | {
      op: 'connect';
      id?: string;
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
      label?: string;
      /** 'bezier' | 'smoothstep' | 'step' | 'straight' or a custom type. */
      type?: string;
      animated?: boolean;
    }
  | { op: 'remove_edge'; id: string }
  | { op: 'update_edge'; id: string; label?: string; animated?: boolean; data?: Record<string, unknown> }
  | {
      /** Execution visualization sugar: sets data.status on a node. */
      op: 'set_status';
      id: string;
      status: 'idle' | 'running' | 'ok' | 'error' | (string & {});
      /** Optional message stored as data.statusMessage. */
      message?: string;
    }
  | { op: 'select'; nodes?: string[]; edges?: string[] }
  | { op: 'layout'; type?: LayoutType; direction?: LayoutDirection }
  | { op: 'fit_view'; nodes?: string[] }
  | { op: 'focus_node'; id: string }
  | { op: 'clear' };

export interface ApplyResult {
  applied: number;
  errors: { index: number; op: FlowOperation; error: string }[];
  /** Ids of nodes created by this batch. */
  createdNodes: string[];
  createdEdges: string[];
}

export interface ApplyOptions {
  /** Group the batch into one undo entry (default true). */
  transact?: boolean;
  /**
   * When nodes arrive without positions, run this layout afterwards
   * (default 'layered'). Pass false to place them in a simple cascade.
   */
  autoLayout?: LayoutType | false;
  /** Fit the view after applying when the batch changed the graph. */
  fitView?: boolean;
  /** Animation duration for layout/fitView (ms). */
  duration?: number;
}

const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** Apply a batch of agent operations to a store. Never throws. */
export const applyOperations = (
  store: FlowStore,
  operations: FlowOperation[],
  options: ApplyOptions = {}
): ApplyResult => {
  const result: ApplyResult = { applied: 0, errors: [], createdNodes: [], createdEdges: [] };
  const needsLayout: string[] = [];
  let structureChanged = false;
  let cascade = 0;

  const fail = (index: number, op: FlowOperation, error: string): void => {
    result.errors.push({ index, op, error });
  };

  const applyOne = (op: FlowOperation, index: number): void => {
    switch (op.op) {
      case 'add_node': {
        const id = op.id ?? uid('n');
        if (store.nodes.has(id)) return fail(index, op, `node "${id}" already exists`);
        if (op.parentId && !store.nodes.has(op.parentId)) {
          return fail(index, op, `parent "${op.parentId}" not found`);
        }
        const hasPosition = op.position != null;
        const node: Node = {
          id,
          type: op.type,
          position: op.position ?? { x: cascade * 40, y: cascade * 40 },
          data: { ...(op.label != null ? { label: op.label } : {}), ...op.data },
          parentId: op.parentId,
          width: op.width,
          height: op.height,
        };
        if (!hasPosition) {
          cascade++;
          needsLayout.push(id);
        }
        store.addNode(node);
        result.createdNodes.push(id);
        structureChanged = true;
        result.applied++;
        return;
      }
      case 'update_node': {
        const prev = store.getNode(op.id);
        if (!prev) return fail(index, op, `node "${op.id}" not found`);
        const patch: Partial<Node> = {};
        if (op.position) patch.position = op.position;
        if (op.type != null) patch.type = op.type;
        if (op.data || op.label != null) {
          patch.data = {
            ...prev.data,
            ...(op.label != null ? { label: op.label } : {}),
            ...op.data,
          };
        }
        store.updateNode(op.id, patch);
        result.applied++;
        return;
      }
      case 'remove_node': {
        if (!store.nodes.has(op.id)) return fail(index, op, `node "${op.id}" not found`);
        store.removeNodes([op.id]);
        structureChanged = true;
        result.applied++;
        return;
      }
      case 'connect': {
        const verdict = store.validateCandidate({
          source: op.source,
          target: op.target,
          sourceHandle: op.sourceHandle,
          targetHandle: op.targetHandle,
        });
        if (verdict !== true) return fail(index, op, verdict);
        const edge = store.connect(
          {
            source: op.source,
            target: op.target,
            sourceHandle: op.sourceHandle,
            targetHandle: op.targetHandle,
          },
          {
            ...(op.id ? { id: op.id } : {}),
            ...(op.label != null ? { label: op.label } : {}),
            ...(op.type != null ? { type: op.type } : {}),
            ...(op.animated != null ? { animated: op.animated } : {}),
          }
        );
        if (!edge) return fail(index, op, 'connection rejected');
        result.createdEdges.push(edge.id);
        structureChanged = true;
        result.applied++;
        return;
      }
      case 'remove_edge': {
        if (!store.edges.has(op.id)) return fail(index, op, `edge "${op.id}" not found`);
        store.removeEdges([op.id]);
        structureChanged = true;
        result.applied++;
        return;
      }
      case 'update_edge': {
        const prev = store.getEdge(op.id);
        if (!prev) return fail(index, op, `edge "${op.id}" not found`);
        const patch: Partial<Edge> = {};
        if (op.label != null) patch.label = op.label;
        if (op.animated != null) patch.animated = op.animated;
        if (op.data) patch.data = { ...prev.data, ...op.data };
        store.updateEdge(op.id, patch);
        result.applied++;
        return;
      }
      case 'set_status': {
        const prev = store.getNode(op.id);
        if (!prev) return fail(index, op, `node "${op.id}" not found`);
        store.updateNodeData(op.id, {
          status: op.status,
          ...(op.message != null ? { statusMessage: op.message } : {}),
        });
        // Animate edges into a running node for live execution feel.
        for (const e of store.edgesOf(op.id)) {
          if (e.target === op.id && !!e.animated !== (op.status === 'running')) {
            store.updateEdge(e.id, { animated: op.status === 'running' });
          }
        }
        result.applied++;
        return;
      }
      case 'select': {
        store.setSelection(op.nodes ?? [], op.edges ?? []);
        result.applied++;
        return;
      }
      case 'layout': {
        runLayout(store, op.type ?? 'layered', {
          direction: op.direction,
          duration: options.duration ?? 300,
        });
        result.applied++;
        return;
      }
      case 'fit_view': {
        store.fitView({ nodes: op.nodes, duration: options.duration ?? 300, padding: 0.15 });
        result.applied++;
        return;
      }
      case 'focus_node': {
        if (!store.nodes.has(op.id)) return fail(index, op, `node "${op.id}" not found`);
        store.centerNode(op.id, options.duration ?? 300);
        result.applied++;
        return;
      }
      case 'clear': {
        store.setGraph([], []);
        structureChanged = true;
        result.applied++;
        return;
      }
      default:
        return fail(index, op, `unknown op "${(op as { op?: unknown }).op}"`);
    }
  };

  const run = (): void => {
    operations.forEach((op, i) => {
      try {
        applyOne(op, i);
      } catch (e) {
        fail(i, op, e instanceof Error ? e.message : String(e));
      }
    });
    if (needsLayout.length > 0 && options.autoLayout !== false) {
      runLayout(store, options.autoLayout ?? 'layered', {
        duration: options.duration ?? 300,
        fitView: options.fitView !== false,
      });
    } else if (options.fitView && structureChanged) {
      store.fitView({ duration: options.duration ?? 300, padding: 0.15 });
    }
  };

  if (options.transact !== false) store.transact('agent operations', run);
  else run();

  return result;
};

/**
 * Compact graph description for LLM context windows. ~10 tokens per node,
 * positions omitted by default (agents rarely need them).
 */
export const describeGraph = (
  store: FlowStore,
  { includePositions = false, includeData = false }: { includePositions?: boolean; includeData?: boolean } = {}
): {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  selection: { nodes: string[]; edges: string[] };
} => {
  const nodes = store.getNodes().map((n) => {
    const out: Record<string, unknown> = { id: n.id };
    if (n.type) out.type = n.type;
    const label = asString((n.data as Record<string, unknown>)?.label);
    if (label) out.label = label;
    if (n.parentId) out.parentId = n.parentId;
    if (includePositions) out.position = n.position;
    if (includeData) out.data = n.data;
    return out;
  });
  const edges = store.getEdges().map((e) => {
    const out: Record<string, unknown> = { source: e.source, target: e.target };
    if (e.label) out.label = e.label;
    if (e.sourceHandle) out.sourceHandle = e.sourceHandle;
    if (e.targetHandle) out.targetHandle = e.targetHandle;
    return out;
  });
  return {
    nodes,
    edges,
    selection: { nodes: [...store.selectedNodes], edges: [...store.selectedEdges] },
  };
};

/** Mermaid flowchart of the graph — the most token-efficient LLM context. */
export const toMermaid = (store: FlowStore, direction: 'LR' | 'TD' = 'LR'): string => {
  const lines = [`flowchart ${direction}`];
  const esc = (s: string): string => s.replace(/["\[\]{}|]/g, ' ').trim();
  for (const n of store.getNodes()) {
    const label = asString((n.data as Record<string, unknown>)?.label) ?? n.id;
    lines.push(`  ${n.id}["${esc(label)}"]`);
  }
  for (const e of store.getEdges()) {
    lines.push(e.label ? `  ${e.source} -->|${esc(e.label)}| ${e.target}` : `  ${e.source} --> ${e.target}`);
  }
  return lines.join('\n');
};

/**
 * JSON Schema for a single FlowOperation — plug it straight into an LLM
 * tool definition (Anthropic tool `input_schema` / OpenAI function
 * `parameters` accept `{ type: 'object', properties: { operations: { type:
 * 'array', items: operationSchema } } }`).
 */
export const operationSchema: Record<string, unknown> = {
  type: 'object',
  required: ['op'],
  properties: {
    op: {
      type: 'string',
      enum: [
        'add_node',
        'update_node',
        'remove_node',
        'connect',
        'remove_edge',
        'update_edge',
        'set_status',
        'select',
        'layout',
        'fit_view',
        'focus_node',
        'clear',
      ],
    },
    id: { type: 'string', description: 'element id (auto-generated for add_node when omitted)' },
    type: { type: 'string', description: 'node/edge type key, or layout algorithm for op=layout' },
    label: { type: 'string' },
    data: { type: 'object', description: 'merged into node/edge data' },
    position: {
      type: 'object',
      properties: { x: { type: 'number' }, y: { type: 'number' } },
      description: 'omit to auto-layout new nodes',
    },
    parentId: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    source: { type: 'string' },
    target: { type: 'string' },
    sourceHandle: { type: 'string' },
    targetHandle: { type: 'string' },
    animated: { type: 'boolean' },
    status: { type: 'string', enum: ['idle', 'running', 'ok', 'error'] },
    message: { type: 'string' },
    nodes: { type: 'array', items: { type: 'string' } },
    edges: { type: 'array', items: { type: 'string' } },
    direction: { type: 'string', enum: ['LR', 'RL', 'TB', 'BT'] },
  },
};

/**
 * Ready-made system-prompt fragment teaching an LLM the operation format.
 * Compose it with your own instructions.
 */
export const OPERATIONS_PROMPT = `You can edit a node-based canvas by emitting an array of operations:
- {"op":"add_node","id":"...","type":"...","label":"...","data":{...}} — omit "position" and the canvas auto-layouts
- {"op":"connect","source":"a","target":"b","label":"..."} — creates a validated edge
- {"op":"update_node","id":"a","label":"...","data":{...}} / {"op":"remove_node","id":"a"}
- {"op":"update_edge","id":"e1",...} / {"op":"remove_edge","id":"e1"}
- {"op":"set_status","id":"a","status":"running|ok|error","message":"..."} — execution visualization
- {"op":"layout","type":"layered|tree|force|radial|grid","direction":"LR"} · {"op":"fit_view"} · {"op":"focus_node","id":"a"} · {"op":"select","nodes":["a"]} · {"op":"clear"}
Rules: reference only existing ids when connecting; ids must be unique; prefer stable, descriptive ids ("fetch-data", not "node1").`;
