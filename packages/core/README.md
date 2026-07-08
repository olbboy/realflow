# @realflow/core

[![npm version](https://img.shields.io/npm/v/@realflow/core.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@realflow/core)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/olbboy/realflow/blob/main/LICENSE)
[![types](https://img.shields.io/badge/types-included-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

The **headless, zero-dependency engine** behind [RealFlow](https://github.com/olbboy/realflow) —
a reactive graph store, spatial index, edge-path math, auto-layouts, undo/redo,
graph algorithms and an AI-operations layer. No DOM, no React, no dependencies:
it runs in the browser, in Node.js, in a worker, or in a test.

`@realflow/core` is what powers [`@realflow/react`](https://www.npmjs.com/package/@realflow/react),
but you can use it on its own for **server-side validation**, CLI tooling, or any
place you need graph logic without a renderer.

```bash
npm install @realflow/core
```

## What's inside

- **Reactive store** (`FlowStore`) — fine-grained pub/sub where each node and
  edge has its own topic (`node:<id>`, `edge:<id>`), so a change touches only
  what subscribed to it.
- **Spatial hash index** — O(1)-ish viewport queries and culling for large graphs.
- **Edge geometry** — `bezier` / `smoothstep` / `step` / `straight`, plus
  `orthogonal` routing that goes *around* nodes (Hanan-grid A*).
- **Auto-layout** — `layered` (Sugiyama, handles cycles), `tree`, `force`
  (seeded/deterministic), `radial`, `grid`. Zero deps — no dagre, no elkjs.
  Plus off-thread (`layoutInWorker`) and `incrementalLayout`.
- **Transactional history** — every mutation recorded with its inverse; group
  with `transact(label, fn)`; drags coalesce into one entry.
- **Graph algorithms** — `topologicalSort`, `hasCycle`, `connectedComponents`,
  `shortestPath`, `getAncestors`, `getDescendants`, `getIncomers`, `getOutgoers`.
- **AI operations** — a validated JSON operation format (`applyOperations`) that
  never throws, an LLM tool schema (`operationSchema`, `OPERATIONS_PROMPT`), and
  graph serializers (`describeGraph`, `toMermaid`).
- **Real-time collaboration** — transport-agnostic `Collab` (Lamport-clock LWW,
  order-independent convergence) and `Presence`.

## Quick start

```ts
import {
  FlowStore, topologicalSort, hasCycle,
  applyOperations, describeGraph, toMermaid,
} from '@realflow/core';

const store = new FlowStore({
  nodes: [
    { id: 'fetch', position: { x: 0, y: 0 }, data: { label: 'Fetch' } },
    { id: 'parse', position: { x: 240, y: 0 }, data: { label: 'Parse' } },
  ],
  edges: [{ id: 'e1', source: 'fetch', target: 'parse' }],
});

// Graph algorithms on the live store
topologicalSort(store); // ['fetch', 'parse']
hasCycle(store);        // false

// Drive it with validated operations (great for LLM tool-calling / server-side).
// Never throws — invalid ops are collected as errors; one batch = one undo entry.
const { errors } = applyOperations(store, [
  { op: 'add_node', id: 'retry', label: 'Retry (3x)' },
  { op: 'connect', source: 'parse', target: 'retry' },
  { op: 'set_status', id: 'fetch', status: 'running', message: 'batch 4/12' },
]);

// Compact serializations for a model's context
describeGraph(store); // structured JSON
toMermaid(store);     // Mermaid diagram source
```

## Server-side validation

Because the engine is dependency-free and never touches the DOM, you can validate
agent- or client-supplied graphs on the server with the exact logic the UI runs:

```ts
import { FlowStore, applyOperations, hasCycle } from '@realflow/core';

export function validateGraph(snapshot, ops) {
  const store = new FlowStore();
  store.loadSnapshot(snapshot);
  const { errors } = applyOperations(store, ops);
  if (errors.length) return { ok: false, errors };
  if (hasCycle(store)) return { ok: false, errors: ['graph must be acyclic'] };
  return { ok: true, snapshot: store.toSnapshot() };
}
```

## Related packages

| Package | What it is |
| --- | --- |
| [`@realflow/react`](https://www.npmjs.com/package/@realflow/react) | React renderer built on this engine |
| [`@realflow/compat`](https://www.npmjs.com/package/@realflow/compat) | React Flow (xyflow) API compatibility adapter |

## Documentation

- [Core concepts & API](https://github.com/olbboy/realflow/blob/main/docs/api.md)
- [Auto-layout](https://github.com/olbboy/realflow/blob/main/docs/layout.md)
- [AI agent integration](https://github.com/olbboy/realflow/blob/main/docs/ai-integration.md)
- [Collaboration](https://github.com/olbboy/realflow/blob/main/docs/collaboration.md)

## License

[MIT](https://github.com/olbboy/realflow/blob/main/LICENSE) © RealFlow contributors.
