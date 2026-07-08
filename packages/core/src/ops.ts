import type { Edge, Node, XY } from './types';
import { type FlowStore, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './store';
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
      width?: number;
      height?: number;
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

/** Coerce to a finite number, else undefined — the trust boundary for
 *  agent/LLM numeric input (a Symbol or huge value must never reach math). */
const finiteNum = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** Clamp a dimension to a sane, bucketable range. */
const dim = (v: unknown): number | undefined => {
  const n = finiteNum(v);
  if (n == null) return undefined;
  return Math.max(0, Math.min(n, 1e6));
};

/** Only spread real plain-object data; never a Symbol/array/primitive. */
const toData = (v: unknown): Record<string, unknown> =>
  v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** A valid {x,y} in a bucketable range, or null. */
const point = (v: unknown): { x: number; y: number } | null => {
  if (v == null || typeof v !== 'object') return null;
  const x = finiteNum((v as { x?: unknown }).x);
  const y = finiteNum((v as { y?: unknown }).y);
  if (x == null || y == null) return null;
  const CAP = 1e9; // far beyond any real canvas; keeps the spatial index sane
  return { x: Math.max(-CAP, Math.min(x, CAP)), y: Math.max(-CAP, Math.min(y, CAP)) };
};

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
        const id = typeof op.id === 'string' && op.id !== '' ? op.id : uid('n');
        if (store.nodes.has(id)) return fail(index, op, `node "${id}" already exists`);
        const parentId = typeof op.parentId === 'string' ? op.parentId : undefined;
        if (parentId && !store.nodes.has(parentId)) {
          return fail(index, op, `parent "${parentId}" not found`);
        }
        const pos = point(op.position);
        const node: Node = {
          id,
          type: typeof op.type === 'string' ? op.type : undefined,
          position: pos ?? { x: cascade * 40, y: cascade * 40 },
          data: { ...(op.label != null ? { label: op.label } : {}), ...toData(op.data) },
          parentId,
          width: dim(op.width),
          height: dim(op.height),
        };
        if (!pos) {
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
        if (!prev) return fail(index, op, `node "${String(op.id)}" not found`);
        const patch: Partial<Node> = {};
        const upos = point(op.position);
        if (upos) patch.position = upos;
        if (typeof op.type === 'string') patch.type = op.type;
        if (op.width !== undefined) patch.width = dim(op.width);
        if (op.height !== undefined) patch.height = dim(op.height);
        if (op.data != null || op.label != null) {
          patch.data = {
            ...prev.data,
            ...(op.label != null ? { label: op.label } : {}),
            ...toData(op.data),
          };
        }
        store.updateNode(op.id, patch);
        result.applied++;
        return;
      }
      case 'remove_node': {
        if (!store.nodes.has(op.id)) return fail(index, op, `node "${String(op.id)}" not found`);
        store.removeNodes([op.id]);
        structureChanged = true;
        result.applied++;
        return;
      }
      case 'connect': {
        const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
        if (typeof op.source !== 'string' || typeof op.target !== 'string') {
          return fail(index, op, 'connect requires string source and target');
        }
        const candidate = {
          source: op.source,
          target: op.target,
          sourceHandle: str(op.sourceHandle),
          targetHandle: str(op.targetHandle),
        };
        const verdict = store.validateCandidate(candidate);
        if (verdict !== true) return fail(index, op, verdict);
        const edge = store.connect(candidate, {
          ...(str(op.id) ? { id: str(op.id) } : {}),
          ...(op.label != null ? { label: String(op.label) } : {}),
          ...(str(op.type) ? { type: str(op.type) } : {}),
          ...(op.animated != null ? { animated: !!op.animated } : {}),
        });
        if (!edge) return fail(index, op, 'connection rejected');
        result.createdEdges.push(edge.id);
        structureChanged = true;
        result.applied++;
        return;
      }
      case 'remove_edge': {
        if (!store.edges.has(op.id)) return fail(index, op, `edge "${String(op.id)}" not found`);
        store.removeEdges([op.id]);
        structureChanged = true;
        result.applied++;
        return;
      }
      case 'update_edge': {
        const prev = store.getEdge(op.id);
        if (!prev) return fail(index, op, `edge "${String(op.id)}" not found`);
        const patch: Partial<Edge> = {};
        if (op.label != null) patch.label = String(op.label);
        if (op.animated != null) patch.animated = !!op.animated;
        if (op.data != null) patch.data = { ...prev.data, ...toData(op.data) };
        store.updateEdge(op.id, patch);
        result.applied++;
        return;
      }
      case 'set_status': {
        const prev = store.getNode(op.id);
        if (!prev) return fail(index, op, `node "${String(op.id)}" not found`);
        const status = asString(op.status) ?? String(op.status);
        store.updateNodeData(op.id, {
          status,
          ...(op.message != null ? { statusMessage: String(op.message) } : {}),
        });
        // Animate edges into a running node for live execution feel.
        const running = status === 'running';
        for (const e of store.edgesOf(op.id)) {
          if (e.target === op.id && !!e.animated !== running) {
            store.updateEdge(e.id, { animated: running });
          }
        }
        result.applied++;
        return;
      }
      case 'select': {
        const ids = (v: unknown): string[] =>
          Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
        store.setSelection(ids(op.nodes), ids(op.edges));
        result.applied++;
        return;
      }
      case 'layout': {
        const validTypes = ['layered', 'tree', 'force', 'radial', 'grid'];
        const type = validTypes.includes(op.type as string) ? (op.type as LayoutType) : 'layered';
        const dirs = ['LR', 'RL', 'TB', 'BT'];
        runLayout(store, type, {
          direction: dirs.includes(op.direction as string) ? (op.direction as LayoutDirection) : undefined,
          duration: options.duration ?? 300,
        });
        result.applied++;
        return;
      }
      case 'fit_view': {
        const nodes = Array.isArray(op.nodes)
          ? op.nodes.filter((x): x is string => typeof x === 'string')
          : undefined;
        store.fitView({ nodes, duration: options.duration ?? 300, padding: 0.15 });
        result.applied++;
        return;
      }
      case 'focus_node': {
        if (typeof op.id !== 'string' || !store.nodes.has(op.id)) {
          return fail(index, op, `node "${String(op.id)}" not found`);
        }
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
  const esc = (s: string): string => s.replace(/["[\]{}|]/g, ' ').trim();
  for (const n of store.getNodes()) {
    const label = asString((n.data as Record<string, unknown>)?.label) ?? n.id;
    lines.push(`  ${n.id}["${esc(label)}"]`);
  }
  for (const e of store.getEdges()) {
    lines.push(e.label ? `  ${e.source} -->|${esc(e.label)}| ${e.target}` : `  ${e.source} --> ${e.target}`);
  }
  return lines.join('\n');
};

/** Options for {@link toSvg}. All colors default to the dark theme. */
export interface ToSvgOptions {
  /** Padding around the graph bounds, in px. Default 24. */
  padding?: number;
  /** Background rect fill; `null` or `'transparent'` omits it. Default `'#0b0d10'`. */
  background?: string | null;
  /** Node rectangle fill. Default `'#16181d'`. */
  nodeFill?: string;
  /** Node rectangle stroke. Default `'#2b2f37'`. */
  nodeStroke?: string;
  /** Node corner radius. Default 8. */
  nodeRadius?: number;
  /** Edge stroke color. Default `'#4b5563'`. */
  edgeStroke?: string;
  /** Label / text color. Default `'#e5e7eb'`. */
  textColor?: string;
  /** Font family. Default a system-UI stack. */
  fontFamily?: string;
}

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Serialize the graph to a standalone, self-contained SVG string — a
 * zero-dependency, vector "download image of the flow". Pure and deterministic
 * (no DOM, no measurement pass), so the same call also runs server-side for
 * thumbnails. Child positions are resolved to absolute coordinates through
 * `parentId`; unmeasured nodes fall back to the default node size.
 */
export const toSvg = (store: FlowStore, options: ToSvgOptions = {}): string => {
  const {
    padding = 24,
    background = '#0b0d10',
    nodeFill = '#16181d',
    nodeStroke = '#2b2f37',
    nodeRadius = 8,
    edgeStroke = '#4b5563',
    textColor = '#e5e7eb',
    fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  } = options;

  const nodes = store.getNodes();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Absolute position = this node's position plus every ancestor's (cycle-guarded).
  const absPos = (n: Node): XY => {
    let x = n.position.x;
    let y = n.position.y;
    const seen = new Set<string>([n.id]);
    let p = n.parentId ? byId.get(n.parentId) : undefined;
    while (p && !seen.has(p.id)) {
      x += p.position.x;
      y += p.position.y;
      seen.add(p.id);
      p = p.parentId ? byId.get(p.parentId) : undefined;
    }
    return { x, y };
  };

  const box = (n: Node): { x: number; y: number; w: number; h: number } => {
    const { x, y } = absPos(n);
    return { x, y, w: n.width ?? DEFAULT_NODE_WIDTH, h: n.height ?? DEFAULT_NODE_HEIGHT };
  };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const b = box(n);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  if (!Number.isFinite(minX)) {
    // Empty graph — emit a valid, non-NaN placeholder viewBox.
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = maxX - minX + padding * 2;
  const vbH = maxY - minY + padding * 2;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}" font-family="${xmlEscape(fontFamily)}">`,
  ];
  if (background && background !== 'transparent') {
    parts.push(`<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${xmlEscape(background)}"/>`);
  }

  // Edges under nodes: source right-mid → target left-mid, as a bezier.
  for (const e of store.getEdges()) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) continue;
    const sb = box(s);
    const tb = box(t);
    const x1 = sb.x + sb.w;
    const y1 = sb.y + sb.h / 2;
    const x2 = tb.x;
    const y2 = tb.y + tb.h / 2;
    const mx = (x1 + x2) / 2;
    parts.push(
      `<path d="M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" fill="none" stroke="${xmlEscape(edgeStroke)}" stroke-width="1.5"/>`
    );
    if (e.label) {
      parts.push(
        `<text x="${mx}" y="${(y1 + y2) / 2 - 4}" fill="${xmlEscape(textColor)}" font-size="11" text-anchor="middle">${xmlEscape(e.label)}</text>`
      );
    }
  }

  // Nodes on top.
  for (const n of nodes) {
    const b = box(n);
    parts.push(
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${nodeRadius}" fill="${xmlEscape(nodeFill)}" stroke="${xmlEscape(nodeStroke)}" stroke-width="1"/>`
    );
    const label = asString((n.data as Record<string, unknown>)?.label) ?? n.id;
    parts.push(
      `<text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 4}" fill="${xmlEscape(textColor)}" font-size="13" text-anchor="middle">${xmlEscape(label)}</text>`
    );
  }

  parts.push('</svg>');
  return parts.join('\n');
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
