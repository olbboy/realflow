<div align="center">

# ◆ RealFlow

**Node-based UIs for React, reimagined.**

[![CI](https://github.com/olbboy/realflow/actions/workflows/ci.yml/badge.svg)](https://github.com/olbboy/realflow/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@realflow/react.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@realflow/react)
[![npm downloads](https://img.shields.io/npm/dm/@realflow/react.svg?color=cb3837)](https://www.npmjs.com/package/@realflow/react)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@realflow/react?label=minzip)](https://bundlephobia.com/package/@realflow/react)
[![types](https://img.shields.io/badge/types-included-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

The fastest open source library for building flow editors, workflow
builders, data pipelines and node graphs with React — with the features
other libraries put behind a paywall built in and free. **All 16 React Flow
Pro examples** now have a working, MIT-free RealFlow equivalent, each backed
by a test and a live render — the head-to-head is in [GAPS.md](./GAPS.md).

[Quick start](#quick-start) · [Why RealFlow](#why-realflow) · [Features](#features) · [Docs](./docs/getting-started.md) · [Live demo](#run-the-demo)

![RealFlow showcase](./docs/assets/showcase-light.png)

</div>

---

## Why RealFlow

React Flow (xyflow) made node-based UIs mainstream. RealFlow starts where it
stops — every row in this table is a deliberate design decision, not an
add-on:

| | **RealFlow** | React Flow (xyflow) |
| --- | --- | --- |
| Undo / redo | ✅ Built in, transactional, drag-coalescing | 💰 Pro example, DIY |
| Auto-layout | ✅ Built in: layered, tree, force, radial, grid — zero deps | 💰 Pro example + dagre/elkjs |
| Alignment guides + snapping | ✅ Built in, Figma-style | 💰 Pro example ("helper lines") |
| Viewport culling | ✅ On by default, spatial-index backed, hysteresis | ⚠️ Opt-in, linear scan |
| Re-render on drag | ✅ Only the dragged node + its edges | ⚠️ Store-wide change dispatch |
| Pan / zoom | ✅ Direct DOM transform — **zero** React renders | ⚠️ Renders through the store |
| MiniMap | ✅ Canvas (no per-node React elements) | ⚠️ One SVG React element per node |
| Typed ports | ✅ `dataType` + `maxConnections` on handles, cycle prevention | ⚠️ Single `isValidConnection` callback |
| AI-agent integration | ✅ JSON operations + validated executor, LLM tool schema, graph→Mermaid | ❌ DIY |
| Orthogonal routing w/ obstacle avoidance | ✅ Edges route **around** nodes (A*), re-route live | ❌ Edges cross nodes |
| Real-time collaboration | ✅ Transport-agnostic CRDT-style sync + presence, Yjs-ready | ❌ DIY |
| Migration path | ✅ `@realflow/compat` — drop-in React Flow API adapter | — |
| Copy / paste / duplicate | ✅ Built in (⌘C/V/D/X), id-remapped, one undo | ⚠️ DIY |
| NodeResizer / NodeToolbar / edge reconnect | ✅ Built in | ✅ (some Pro) |
| Accessibility | ✅ Focusable nodes, aria, spatial keyboard nav | ⚠️ Partial |
| Graph algorithms | ✅ Topo sort, cycle detect, components, shortest path, ancestors | ⚠️ `getIncomers` / `getOutgoers` |
| State management | ✅ `useRealFlow()` — no reducers, no change handlers | ⚠️ `onNodesChange` + `applyNodeChanges` boilerplate |
| Headless core | ✅ `@realflow/core` — zero dependencies, runs anywhere | ⚠️ `@xyflow/system` (depends on d3-zoom/d3-drag) |
| Default look | ✅ Polished theme, dark mode, animations out of the box | ⚠️ Gray boxes |
| License | ✅ MIT, everything free | MIT + paid Pro examples |

**Head-to-head benchmark vs React Flow** (reproducible: `npm run bench`,
production builds, identical scenes, Chromium software rendering, every pan
verified to actually move the viewport — see [BENCHMARKS.md](./benchmarks/BENCHMARKS.md)):

| 10,000 nodes, zoomed-in editing | Pan FPS | DOM nodes | Heap |
| --- | ---: | ---: | ---: |
| **RealFlow** | **43** | **143** | **18 MB** |
| React Flow (default) | 4 | 10,000 | 239 MB |
| React Flow (`onlyRenderVisibleElements`) | 9 | 49 | 34 MB |

RealFlow culls off-screen nodes **by default** via a spatial hash index, so a
10k-node graph stays interactive while using **~13× less memory than React
Flow's default** (culling off). Against React Flow's own
`onlyRenderVisibleElements`, memory is close — RealFlow's durable edge there is
**FPS** (zero-render pan), not memory. When every node is genuinely on-screen
(zoomed all the way out), both libraries are paint-bound and roughly tied —
RealFlow at about half the memory. Numbers are honest and reproducible, not
marketing (full audit: [AUDIT.md](./AUDIT.md)).

## Quick start

```bash
npm install @realflow/react
```

```tsx
import { RealFlow, Background, Controls, MiniMap } from '@realflow/react';
import '@realflow/react/styles.css';

const nodes = [
  { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Hello' } },
  { id: 'b', position: { x: 260, y: 80 }, data: { label: 'World', description: 'it just works' } },
];
const edges = [{ id: 'e1', source: 'a', target: 'b', animated: true }];

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <RealFlow defaultNodes={nodes} defaultEdges={edges}>
        <Background />
        <Controls />
        <MiniMap />
      </RealFlow>
    </div>
  );
}
```

That's the whole app. Pan, zoom, drag, connect, box-select, delete,
**undo/redo**, alignment guides, dark mode — all already working.
No `onNodesChange`, no `applyNodeChanges`, no state wiring.

### Drive it imperatively

```tsx
import { useRealFlow } from '@realflow/react';

function Toolbar() {
  const flow = useRealFlow();
  return (
    <>
      <button onClick={() => flow.addNode({ id: crypto.randomUUID(), position: { x: 0, y: 0 }, data: { label: 'New' } })}>
        Add
      </button>
      <button onClick={() => flow.layout('layered', { duration: 300 })}>Auto layout</button>
      <button onClick={() => flow.undo()}>Undo</button>
      <button onClick={() => flow.fitView({ duration: 300 })}>Fit</button>
    </>
  );
}
```

## Features

### ⚡ Performance as architecture, not an afterthought

- **Fine-grained reactivity** — every node and edge subscribes to its own
  topic (`node:<id>`, `edge:<id>`). Dragging one node re-renders one node
  and its edges. Nothing else.
- **Zero-render pan/zoom** — the viewport transform is written straight to
  the DOM. React is not involved in a single pan frame.
- **Spatial hash culling** — only visible nodes are mounted, with overscan
  hysteresis so panning doesn't churn mounts every frame.
- **Batched measurement** — one shared `ResizeObserver`, and handle
  positions are measured in a single read-then-write pass (no layout
  thrashing when 500 nodes mount at once).
- **Canvas MiniMap** — repaints 10k nodes in about a millisecond.

### 🎨 Beautiful by default

Light and dark themes with a modern look — soft shadows, hover elevation,
selection rings, animated edges — all themeable with CSS variables
(`--rf-accent`, `--rf-node-bg`, …). `colorMode="auto"` follows the OS.

![Dark mode](./docs/assets/showcase-dark.png)

### 🧭 Built-in auto-layout (no dagre, no elkjs)

```tsx
flow.layout('layered', { direction: 'LR' }); // Sugiyama-style, handles cycles
flow.layout('tree');                          // tidy trees & forests
flow.layout('force', { linkDistance: 180 });  // deterministic (seeded) FR
flow.layout('radial');                        // BFS rings
flow.layout('grid', { columns: 8 });
```

Every layout is a single undoable transaction and knows about node sizes,
subflows and cycles.

![Auto layout](./docs/assets/auto-layout.png)

### ↩️ Real undo/redo

Every mutation is recorded with its inverse. Drags coalesce into one entry.
Group anything with `flow.transact('label', () => { ... })`. `⌘Z` / `⌘⇧Z`
work out of the box, and `useHistory()` gives you reactive
`canUndo`/`canRedo` for your own UI.

### 🔌 Typed, validated connections

```tsx
<Handle kind="source" side="right" dataType="tensor" maxConnections={1} />
```

Incompatible types can't connect. Full handles are rejected. Set
`preventCycles` and edges that would create a loop are refused — validated
live while dragging, with the connection line turning red.

### 📐 Figma-style alignment guides

Drag a node near another's edge or center: guide lines appear and the node
snaps. On by default (`alignmentGuides={false}` to disable), plus optional
`snapGrid`.

### 🧩 Custom everything

```tsx
function MetricNode({ data, selected }: NodeProps<{ kpi: string }>) {
  return (
    <div className={selected ? 'ring' : ''}>
      <Handle kind="target" side="left" />
      {data.kpi}
      <Handle kind="source" side="right" />
    </div>
  );
}
<RealFlow nodeTypes={{ metric: MetricNode }} … />
```

Handles are measured automatically — put them anywhere in your markup and
edges anchor exactly. Custom edges get precomputed geometry
(`path`, `labelX/Y`, endpoints) as props.

### 🤖 Built for the AI era

An LLM can drive the canvas through a validated JSON operation format —
with a ready-made tool schema and prompt fragment:

```ts
import { applyOperations, operationSchema, OPERATIONS_PROMPT, describeGraph, toMermaid } from '@realflow/core';

// agent emits ops via tool-calling…
applyOperations(flow.store, [
  { op: 'add_node', id: 'retry', label: 'Retry (3x)' },
  { op: 'connect', source: 'fetch', target: 'retry' },
  { op: 'set_status', id: 'fetch', status: 'running', message: 'batch 4/12' },
]); // never throws — errors are collected; one batch = one ⌘Z

describeGraph(store); // compact JSON for the model's context
toMermaid(store);     // or Mermaid — the cheapest tokens you'll spend
```

Auto-layout places position-less nodes, `set_status` animates live
execution, and the same zero-dependency engine validates agent output
server-side before it reaches a client. It's provider-agnostic:
[`examples/ai-agent`](./examples/ai-agent) drives the canvas from **GLM,
Gemini or Anthropic** (whichever key you set) with one transactional undo per
turn. See the **AI copilot** demo tab and
[docs/ai-integration.md](./docs/ai-integration.md).

### 🗂 Subflows & groups

`parentId` nests nodes; children move with their parent for free (one
transform, not N re-renders). `extent: 'parent'` clamps children inside.
Deleting a group re-parents children instead of orphaning them.

### 🧠 A real graph library underneath

```ts
import { topologicalSort, hasCycle, connectedComponents, shortestPath,
         getAncestors, getDescendants, getIncomers, getOutgoers } from '@realflow/core';
```

`@realflow/core` is headless and dependency-free — use it in Node.js for
server-side validation, tests, or CLI tooling with the exact engine the UI
runs.

### And also

Controlled *or* uncontrolled modes · box selection · keyboard shortcuts
(delete, select-all, arrow-nudge) · edge labels & markers · animated edges ·
`bezier` / `smoothstep` / `step` / `straight` paths · MiniMap
drag-to-navigate · `fitView`/`centerNode` with smooth animation ·
save/restore snapshots · SSR-safe · touch support with two-finger pinch
zoom · `panOnScroll` trackpad mode (Figma-style) · level-of-detail
rendering when zoomed out · works with Tailwind, shadcn/ui, Radix, Base UI,
MUI ([integration guide](./docs/integrations.md)).

### 🔄 Migrating from React Flow?

`@realflow/compat` is a drop-in adapter — change your imports and an existing
React Flow app runs on RealFlow's engine (undo/redo and culling included, free):

```diff
- import { ReactFlow, Handle, Position, useReactFlow } from '@xyflow/react';
+ import { ReactFlow, Handle, Position, useReactFlow } from '@realflow/compat';
```

`useNodesState`, `onNodesChange`/`applyNodeChanges`, `onConnect`, custom
`nodeTypes`, `<Handle type position>` all keep working. See
[docs/migration.md](./docs/migration.md).

## Packages

| Package | What it is |
| --- | --- |
| [`@realflow/core`](./packages/core) | Headless engine: store, spatial index, paths, layouts, history, algorithms, AI ops. Zero dependencies. |
| [`@realflow/react`](./packages/react) | React renderer: `<RealFlow>`, components, hooks, theme. Depends only on core + React. |
| [`@realflow/compat`](./packages/compat) | React Flow (xyflow) API compatibility adapter for migrations. |

## Honesty

Every performance claim here is backed by a reproducible benchmark, and every
feature by a passing test. Three docs keep it honest:
[CLAIMS.md](./CLAIMS.md) audits this README line-by-line against the code;
[AUDIT.md](./AUDIT.md) is the adversarial audit (methodology, reproduced
benchmark, claim-by-claim KEEP/FIX verdicts); [GAPS.md](./GAPS.md) is the
head-to-head against all 16 React Flow Pro examples and names plainly the ones
React Flow still wins. The UI-frameworks demo is built on the **real**
shadcn/ui (Radix) and Base UI packages, and lint, cross-browser E2E and
visual-regression snapshots all run in CI.

## Run the demo

```bash
git clone https://github.com/olbboy/realflow && cd realflow
npm install
npm run dev   # showcase + 1k/5k/10k stress scenes at http://localhost:5173
```

## Development

```bash
npm run build      # build core + react (compat: npm run build -w @realflow/compat)
npm run lint       # ESLint (typescript-eslint + react-hooks)
npm test           # 144 unit/integration tests (vitest)
npm run typecheck  # strict TS across packages
npm run test:e2e   # cross-browser E2E: Chromium/Firefox/WebKit + touch (Playwright)
npm run test:e2e:visual  # visual-regression snapshots (Chromium, pinned baselines)
npm run bench      # reproducible head-to-head benchmark vs React Flow
```

## Documentation

- [Getting started](./docs/getting-started.md)
- [Custom nodes & edges](./docs/custom-nodes.md)
- [Auto-layout: built-in, incremental, off-thread](./docs/layout.md)
- [Real-time collaboration (+ Yjs)](./docs/collaboration.md)
- [AI agent integration](./docs/ai-integration.md)
- [Migrating from React Flow](./docs/migration.md)
- [Tailwind / shadcn / Radix / Base UI](./docs/integrations.md)
- [Performance guide](./docs/performance.md)
- [Core concepts & API](./docs/api.md)

**Interactive examples:** `npm run dev:docs` — a live gallery (basic flow,
custom nodes, auto-layout, smart routing, AI ops, collaboration) with source
shown side-by-side.

**Process builder:** `npm run dev:process` —
[`examples/process-builder`](./examples/process-builder) is a full
approval-workflow editor (custom node cards, a branching condition node,
drag-from-palette, undo/redo, snapshot save) assembled entirely on RealFlow
primitives. A worked reference for building a real application shell on top of
the canvas.

## Contributing

Contributions are welcome — bug fixes, features, docs, benchmarks and honest
critiques all count. Start with **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the
dev setup, project layout, coding conventions and PR checklist. Every change is
expected to keep the [honesty docs](#honesty) true: a new feature ships with a
test, a performance claim ships with a reproducible benchmark.

- 🐛 **Found a bug?** [Open an issue](https://github.com/olbboy/realflow/issues/new/choose).
- 💡 **Have an idea?** [Start a discussion](https://github.com/olbboy/realflow/discussions) or a feature request.
- 🔒 **Security issue?** Please report privately — see [SECURITY.md](./SECURITY.md).
- 🤝 **Be kind.** This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) — every feature above is free, forever.
Copyright © 2026 RealFlow contributors.
