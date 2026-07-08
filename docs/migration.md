# Migrating from React Flow (xyflow)

`@realflow/compat` lets an existing React Flow app run on RealFlow's engine with
minimal changes — often just the imports.

## The one-line migration

```diff
- import { ReactFlow, Background, Controls, MiniMap, Handle, Position,
-          useReactFlow, useNodesState, useEdgesState, addEdge } from '@xyflow/react';
- import '@xyflow/react/dist/style.css';
+ import { ReactFlow, Background, Controls, MiniMap, Handle, Position,
+          useReactFlow, useNodesState, useEdgesState, addEdge } from '@realflow/compat';
+ import '@realflow/compat/style.css';
```

Your `useNodesState`/`useEdgesState`, `onNodesChange`/`onEdgesChange`,
`onConnect`, custom `nodeTypes`, and `<Handle type=... position=... />`
continue to work unchanged.

## What's mapped

| React Flow | Status in compat |
| --- | --- |
| `<ReactFlow nodes edges onNodesChange onEdgesChange onConnect>` | ✅ |
| `defaultNodes` / `defaultEdges` (uncontrolled) | ✅ |
| `nodeTypes`, custom node components (`NodeProps`) | ✅ |
| `<Handle type position id isConnectable>` | ✅ |
| `Position`, `MarkerType`, `ConnectionMode`, `ConnectionLineType` | ✅ |
| `useReactFlow()` — getNodes/setNodes/getEdges/setEdges, addNodes/addEdges, deleteElements, fitView, zoomIn/Out/To, setViewport/getViewport, setCenter, screenToFlowPosition, flowToScreenPosition, toObject | ✅ |
| `useNodesState` / `useEdgesState` | ✅ |
| `applyNodeChanges` / `applyEdgeChanges` | ✅ |
| `addEdge` / `reconnectEdge` | ✅ |
| `<Background variant gap>` / `<Controls>` / `<MiniMap>` / `<Panel>` | ✅ (native RealFlow) |
| `<ReactFlowProvider>` | ✅ |
| `onNodeClick`, `onEdgeClick`, `onPaneClick`, `onInit`, `onSelectionChange` | ✅ |
| `fitView`, `minZoom`, `maxZoom`, `snapToGrid`, `snapGrid`, `panOnDrag`, `panOnScroll`, `zoomOnScroll`, `colorMode` | ✅ |

## Bonus: you get RealFlow features for free

After migrating, these work without extra code:

- **Undo/redo** — ⌘Z / ⌘⇧Z, plus `store.transact`.
- **Culling on by default** — no `onlyRenderVisibleElements` flag needed.
- **Copy/paste/duplicate** — ⌘C/⌘V/⌘D/⌘X.
- **Alignment guides** — drag a node near another's edge.
- **Built-in auto-layout** — `useRealFlow()` from `@realflow/react` exposes
  `.layout('layered')` etc. (no dagre/elk dependency).

## Known gaps (be honest)

Not yet mapped in compat (use the native `@realflow/react` API, or contribute):

- `onlyRenderVisibleElements` prop — RealFlow always culls; the prop is a no-op.
- `<NodeResizer>` / `<NodeToolbar>` from `@xyflow/react` — use the
  `@realflow/react` equivalents (same idea, slightly different props).
- `useStore` (Zustand selector into React Flow's internal store) — RealFlow's
  store is different; use `useRealFlow()` / `useFlowSelector()`.
- Some fine-grained props (`connectionRadius`, `elevateNodesOnSelect`,
  `nodeExtent`, edge `pathOptions`) — partial or unmapped.

`onNodesChange` emits change objects for **interactions** (add/remove/select/
drag). Imperative `setNodes` replaces state directly (as in React Flow) and
does not itself emit changes.

## If you're starting fresh

Prefer `@realflow/react` directly — `useRealFlow()` removes the
`onNodesChange`/`applyNodeChanges` boilerplate entirely:

```tsx
const flow = useRealFlow();
flow.addNode({ id: 'x', position: { x: 0, y: 0 }, data: { label: 'New' } });
flow.undo();
```
