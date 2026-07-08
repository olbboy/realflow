import { describe, expect, it } from 'vitest';
import {
  FlowStore,
  applyOperations,
  describeGraph,
  toMermaid,
  operationSchema,
  OPERATIONS_PROMPT,
  type FlowOperation,
} from '@realflow/core';

const pipelineOps: FlowOperation[] = [
  { op: 'add_node', id: 'ingest', label: 'Ingest', type: 'input' },
  { op: 'add_node', id: 'embed', label: 'Embed' },
  { op: 'add_node', id: 'store', label: 'Vector store' },
  { op: 'connect', source: 'ingest', target: 'embed' },
  { op: 'connect', source: 'embed', target: 'store', label: 'vectors' },
];

describe('applyOperations', () => {
  it('builds a graph from agent ops and auto-layouts position-less nodes', () => {
    const store = new FlowStore();
    const res = applyOperations(store, pipelineOps, { autoLayout: 'layered' });
    expect(res.errors).toEqual([]);
    expect(res.applied).toBe(5);
    expect(res.createdNodes).toEqual(['ingest', 'embed', 'store']);
    expect(store.getEdges()).toHaveLength(2);
    // Auto-layout ran: layered LR means increasing x along the chain.
    const x = (id: string) => store.getNode(id)!.position.x;
    expect(x('ingest')).toBeLessThan(x('embed'));
    expect(x('embed')).toBeLessThan(x('store'));
  });

  it('one agent batch = one undo entry', () => {
    const store = new FlowStore();
    applyOperations(store, pipelineOps);
    expect(store.getNodes()).toHaveLength(3);
    store.undo();
    expect(store.getNodes()).toHaveLength(0);
    expect(store.getEdges()).toHaveLength(0);
    store.redo();
    expect(store.getNodes()).toHaveLength(3);
  });

  it('collects errors without corrupting the graph or aborting the batch', () => {
    const store = new FlowStore();
    const res = applyOperations(store, [
      { op: 'add_node', id: 'a', label: 'A' },
      { op: 'add_node', id: 'a', label: 'dup' }, // duplicate id
      { op: 'connect', source: 'a', target: 'ghost' }, // missing node
      { op: 'remove_node', id: 'nope' }, // missing node
      { op: 'add_node', id: 'b', label: 'B' }, // still applies
      { op: 'connect', source: 'a', target: 'b' },
    ]);
    expect(res.applied).toBe(3);
    expect(res.errors).toHaveLength(3);
    expect(res.errors[0].error).toContain('already exists');
    expect(store.getNodes()).toHaveLength(2);
    expect(store.getEdges()).toHaveLength(1);
  });

  it('set_status merges data and animates incoming edges while running', () => {
    const store = new FlowStore();
    applyOperations(store, pipelineOps);
    applyOperations(store, [{ op: 'set_status', id: 'embed', status: 'running', message: 'batch 3/10' }]);
    expect(store.getNode('embed')!.data.status).toBe('running');
    expect(store.getNode('embed')!.data.statusMessage).toBe('batch 3/10');
    const incoming = store.edgesOf('embed').find((e) => e.target === 'embed')!;
    expect(incoming.animated).toBe(true);
    applyOperations(store, [{ op: 'set_status', id: 'embed', status: 'ok' }]);
    expect(store.edgesOf('embed').find((e) => e.target === 'embed')!.animated).toBe(false);
  });

  it('respects existing positions (no auto-layout when all ops position nodes)', () => {
    const store = new FlowStore();
    applyOperations(store, [
      { op: 'add_node', id: 'a', position: { x: 500, y: 500 } },
    ]);
    expect(store.getNode('a')!.position).toEqual({ x: 500, y: 500 });
  });

  it('update ops merge data; select/clear work', () => {
    const store = new FlowStore();
    applyOperations(store, pipelineOps);
    applyOperations(store, [
      { op: 'update_node', id: 'embed', label: 'Embed v2', data: { model: 'voyage-3' } },
      { op: 'select', nodes: ['embed'] },
    ]);
    const n = store.getNode('embed')!;
    expect(n.data.label).toBe('Embed v2');
    expect(n.data.model).toBe('voyage-3');
    expect(store.selectedNodes.has('embed')).toBe(true);
    applyOperations(store, [{ op: 'clear' }]);
    expect(store.getNodes()).toHaveLength(0);
  });

  it('connect validation flows through (cycles rejected when configured)', () => {
    const store = new FlowStore({ preventCycles: true });
    const res = applyOperations(store, [
      ...pipelineOps,
      { op: 'connect', source: 'store', target: 'ingest' }, // would create a cycle
    ]);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].error).toBe('cycle');
    expect(store.getEdges()).toHaveLength(2);
  });
});

describe('LLM context helpers', () => {
  it('describeGraph is compact and correct', () => {
    const store = new FlowStore();
    applyOperations(store, pipelineOps);
    const desc = describeGraph(store);
    expect(desc.nodes).toHaveLength(3);
    expect(desc.nodes[0]).toEqual({ id: 'ingest', type: 'input', label: 'Ingest' });
    expect(desc.edges).toContainEqual({ source: 'embed', target: 'store', label: 'vectors' });
    // No positions unless asked.
    expect('position' in desc.nodes[0]).toBe(false);
    expect(describeGraph(store, { includePositions: true }).nodes[0]).toHaveProperty('position');
  });

  it('toMermaid emits a valid flowchart', () => {
    const store = new FlowStore();
    applyOperations(store, pipelineOps);
    const m = toMermaid(store);
    expect(m).toContain('flowchart LR');
    expect(m).toContain('ingest["Ingest"]');
    expect(m).toContain('embed -->|vectors| store');
  });

  it('exports a tool schema and prompt fragment', () => {
    expect(operationSchema).toHaveProperty('properties');
    expect(OPERATIONS_PROMPT).toContain('add_node');
  });
});
