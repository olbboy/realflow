# Auto-layout: built-in, incremental, and off-thread

ReFlow's five layouts (`layered`, `tree`, `force`, `radial`, `grid`) are pure,
dependency-free functions — no dagre, no elkjs. Three ways to run them.

## 1. Full layout (synchronous)

```ts
const flow = useReflow();
flow.layout('layered', { direction: 'LR' }); // one undoable transaction, fits the view
```

## 2. Incremental — add without reshuffling

Re-running a full layout after adding one node makes the whole diagram jump.
`layoutIncremental` positions **only** the new nodes, next to their connected
neighbors, avoiding overlaps — the existing graph stays put.

```ts
flow.addNode({ id: 'n', position: { x: 0, y: 0 }, data: { label: 'New' } });
flow.addEdge({ id: 'e', source: 'prev', target: 'n' });
flow.layoutIncremental(['n']); // 'prev' and everything else don't move
```

Great for agent/AI flows that stream nodes in one at a time (pairs perfectly
with `applyOperations`).

## 3. Off the main thread (large graphs)

Layout of thousands of nodes can block a frame. The job is pure data, so it
runs in a Web Worker. `layoutAsync` returns a Promise:

```ts
await flow.layoutAsync('force', { iterations: 400 });
```

Without a worker it runs the same pure job and resolves on completion. To
truly offload, run `runLayoutJob` in a worker and apply the result — the
pieces are exported from `@realflow/core`:

```ts
// worker.ts
import { layoutWorkerHandler } from '@realflow/core';
self.onmessage = (e) => self.postMessage(layoutWorkerHandler(e.data));

// app.ts
import { layoutInWorker, applyLayout } from '@realflow/core';
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const { positions } = await layoutInWorker(worker, {
  type: 'force',
  nodes: store.getNodes().map((n) => ({ id: n.id, ...store.nodeSize(n.id) })),
  edges: store.getEdges().map((e) => ({ source: e.source, target: e.target })),
  options: { iterations: 500 },
});
applyLayout(store, new Map(positions.map((p) => [p.id, { x: p.x, y: p.y }])));
```

`layoutInWorker` is transport-agnostic — it also accepts a Node
`worker_threads` Worker, which is how the off-thread path is tested
(`packages/core/test/layout-worker.test.ts` runs a 2,000-node job in a real
worker and correlates concurrent requests by id).

## Algorithm notes

- **layered** — Sugiyama: longest-path ranking, barycenter crossing
  reduction, size-aware coordinates. Handles cycles (greedy back-edge
  reversal).
- **force** — Fruchterman–Reingold with grid-bucketed repulsion; seeded, so
  results are deterministic and reproducible.
- **tree / radial / grid** — tidy tree, BFS rings, and uniform grid.

All are exported as pure functions (`layeredLayout(nodes, edges, opts)` …) for
headless/server use.
