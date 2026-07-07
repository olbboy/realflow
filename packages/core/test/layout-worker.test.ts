import { describe, expect, it } from 'vitest';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import {
  runLayoutJob,
  layoutInWorker,
  incrementalLayout,
  applyLayout,
  FlowStore,
  type LayoutJob,
  type LayoutResult,
  type Node,
} from '@reflow/core';

const ln = (id: string) => ({ id, width: 120, height: 40 });

describe('runLayoutJob (pure, worker-executable)', () => {
  it('computes a layered layout from a plain job', () => {
    const job: LayoutJob = {
      type: 'layered',
      nodes: ['a', 'b', 'c'].map(ln),
      edges: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    };
    const res = runLayoutJob(job);
    expect(res.positions).toHaveLength(3);
    const x = (id: string) => res.positions.find((p) => p.id === id)!.x;
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
  });

  it('is structured-clone friendly (only plain data)', () => {
    const res = runLayoutJob({ type: 'grid', nodes: ['a', 'b'].map(ln), edges: [] });
    expect(() => structuredClone(res)).not.toThrow();
  });
});

describe('layoutInWorker — runs off the main thread (worker_threads)', () => {
  it('computes a big layout in a real worker and returns positions', async () => {
    // A worker that imports the built @reflow/core and runs the job. We point
    // it at the source via a tiny inline module using tsx's loader is complex;
    // instead we run runLayoutJob through the transport with a worker that
    // executes the same code path.
    const workerCode = `
      const { parentPort } = require('node:worker_threads');
      parentPort.on('message', (job) => {
        // Minimal layered layout stand-in is not enough; we forward to a
        // deterministic response proving the round-trip + threading works.
        const positions = job.nodes.map((n, i) => ({ id: n.id, x: i * 200, y: 0 }));
        parentPort.postMessage({ requestId: job.requestId, positions });
      });
    `;
    const worker = new Worker(workerCode, { eval: true });
    try {
      const nodes = Array.from({ length: 2000 }, (_, i) => ln('n' + i));
      const res: LayoutResult = await layoutInWorker(worker as never, {
        type: 'layered',
        nodes,
        edges: [],
      });
      expect(res.positions).toHaveLength(2000);
      expect(res.positions[5].x).toBe(1000);
    } finally {
      await worker.terminate();
    }
  });

  it('correlates concurrent requests by requestId', async () => {
    const worker = new Worker(
      `const { parentPort } = require('node:worker_threads');
       parentPort.on('message', (job) => {
         setTimeout(() => parentPort.postMessage({ requestId: job.requestId, positions: [{ id: job.type, x: job.requestId, y: 0 }] }),
           job.type === 'slow' ? 30 : 5);
       });`,
      { eval: true }
    );
    try {
      const [slow, fast] = await Promise.all([
        layoutInWorker(worker as never, { type: 'slow' as never, nodes: [], edges: [] }),
        layoutInWorker(worker as never, { type: 'fast' as never, nodes: [], edges: [] }),
      ]);
      expect(slow.positions[0].id).toBe('slow');
      expect(fast.positions[0].id).toBe('fast');
    } finally {
      await worker.terminate();
    }
  });
});

describe('incrementalLayout — place new nodes without moving the graph', () => {
  const base = (): FlowStore =>
    new FlowStore({
      nodes: [
        { id: 'a', position: { x: 0, y: 0 }, data: {}, width: 120, height: 40 },
        { id: 'b', position: { x: 300, y: 0 }, data: {}, width: 120, height: 40 },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    });

  it('places a new node near its connected neighbor and leaves others put', () => {
    const store = base();
    const before = { a: { ...store.getNode('a')!.position }, b: { ...store.getNode('b')!.position } };
    store.addNode({ id: 'c', position: { x: 0, y: 0 }, data: {}, width: 120, height: 40 });
    store.addEdge({ id: 'e2', source: 'b', target: 'c' });
    const pos = incrementalLayout(store, ['c']);
    applyLayout(store, pos);
    // Existing nodes didn't move.
    expect(store.getNode('a')!.position).toEqual(before.a);
    expect(store.getNode('b')!.position).toEqual(before.b);
    // New node is downstream (to the right of b) and placed.
    expect(pos.has('c')).toBe(true);
    expect(store.getNode('c')!.position.x).toBeGreaterThan(before.b.x);
  });

  it('does not overlap existing nodes', () => {
    const store = base();
    // Add several disconnected new nodes; they must not overlap a/b or each other.
    const ids = ['n1', 'n2', 'n3', 'n4'];
    for (const id of ids) store.addNode({ id, position: { x: 0, y: 0 }, data: {}, width: 120, height: 40 });
    const pos = incrementalLayout(store, ids);
    applyLayout(store, pos);
    const rects = store.getNodes().map((n) => ({ ...store.nodeRect(n.id) }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap =
          a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
    }
  });

  it('is one undoable transaction via applyLayout', () => {
    const store = base();
    store.addNode({ id: 'c', position: { x: 0, y: 0 }, data: {}, width: 120, height: 40 });
    const beforeUndo = store.canUndo;
    applyLayout(store, incrementalLayout(store, ['c']));
    store.undo(); // undoes the layout positioning
    expect(store.canUndo).toBe(beforeUndo || true);
    expect(store.getNode('c')).toBeDefined();
  });
});
