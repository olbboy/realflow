# API stability

ReFlow is pre-1.0. This document is the contract for what may change.

- **Stable** — will not break within `0.x` without a deprecation path and a
  CHANGELOG migration note. Safe to build on.
- **Experimental** — may change in any minor release. Pin exact versions if
  you depend on these.

## `@reflow/core`

| API | Status |
| --- | --- |
| `FlowStore` construction + `StoreOptions` | Stable |
| Node/Edge/`XY`/`Rect`/`Viewport` types | Stable |
| `addNodes`/`removeNodes`/`updateNode`/`updateNodeData`/`setNodePosition` | Stable |
| `addEdges`/`removeEdges`/`updateEdge`/`connect` | Stable |
| Selection: `setSelection`/`toggleSelection`/`selectAll`/`deleteSelection` | Stable |
| History: `undo`/`redo`/`transact`/`canUndo`/`canRedo` | Stable |
| Viewport: `setViewport`/`fitView`/`zoomBy`/`centerNode` | Stable |
| Clipboard: `copy`/`paste`/`duplicateSelection` | Stable |
| Geometry: `screenToFlow`/`flowToScreen`/`nodeRect`/`nodesBounds` | Stable |
| Edge paths: `bezierPath`/`smoothStepPath`/`stepPath`/`straightPath` | Stable |
| Layouts: `layout`/`computeLayout` + the five algorithms | Stable |
| Algorithms: `topologicalSort`/`hasCycle`/`shortestPath`/… | Stable |
| AI ops: `applyOperations`/`FlowOperation`/`operationSchema` | Stable |
| `describeGraph`/`toMermaid` | Stable |
| `SpatialIndex` | Experimental (internal shape may change) |
| Culling internals (`cull`, `visibleRoots`, hysteresis) | Experimental |
| `nearestNodeInDirection`, `startReconnect` | Experimental |
| `store.subscribe` topic strings | Stable set, may **add** new topics |

## `@reflow/react`

| API | Status |
| --- | --- |
| `<ReFlow>` + documented props | Stable |
| `Handle`, `Background`, `Controls`, `Panel`, `MiniMap` | Stable |
| `useReflow`, `useNodes`, `useEdges`, `useNode`, `useEdge` | Stable |
| `useViewport`, `useSelection`, `useHistory`, `useConnection` | Stable |
| `NodeProps`/`EdgeProps` for custom nodes/edges | Stable |
| `NodeToolbar`, `NodeResizer` | Experimental (styling hooks may change) |
| `useOnSelectionChange`, `useSelectionCount` | Stable |
| `useFlowSelector` (low-level subscription) | Experimental |
| CSS class names (`.rf-*`) | Experimental — theme via CSS **variables**, not class overrides |
| CSS variables (`--rf-*`) | Stable |

## `@reflow/compat`

| API | Status |
| --- | --- |
| React Flow-compatible exports | Experimental — tracks React Flow 12; coverage grows over time. See `docs/migration.md` for the exact map and known gaps. |

## Versioning of the three packages

`@reflow/core`, `@reflow/react`, and `@reflow/compat` are versioned together
and released in lockstep. `@reflow/react` depends on the exact matching
`@reflow/core`; `@reflow/compat` on both.
