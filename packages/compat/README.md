# @realflow/compat

[![npm version](https://img.shields.io/npm/v/@realflow/compat.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@realflow/compat)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/olbboy/realflow/blob/main/LICENSE)
[![types](https://img.shields.io/badge/types-included-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A **drop-in [React Flow](https://github.com/xyflow/xyflow) (xyflow) API
compatibility layer** for [RealFlow](https://github.com/olbboy/realflow).
Migrate an existing React Flow app by changing your imports — and get RealFlow's
**undo/redo and viewport culling for free**, at no extra work.

```bash
npm install @realflow/compat
```

## Migrate in one diff

```diff
- import { ReactFlow, Handle, Position, useReactFlow } from '@xyflow/react';
+ import { ReactFlow, Handle, Position, useReactFlow } from '@realflow/compat';
- import '@xyflow/react/dist/style.css';
+ import '@realflow/compat/style.css';
```

Your existing controlled React Flow code keeps working unchanged:

```tsx
import { useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, type Connection,
} from '@realflow/compat';
import '@realflow/compat/style.css';

const initialNodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Input' } },
  { id: '2', position: { x: 240, y: 80 }, data: { label: 'Output' } },
];
const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

export default function Flow() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

## What's supported

The adapter maps React Flow's controlled model onto RealFlow's engine:

- **Components** — `ReactFlow`, `ReactFlowProvider`, `Handle` (`type` / `position`
  props), `Background`, `MiniMap`, `Controls`, `Panel`, `NodeResizer`, `NodeToolbar`
- **Hooks** — `useReactFlow`, `useNodesState`, `useEdgesState`, `useOnSelectionChange`
- **Change helpers** — `applyNodeChanges`, `applyEdgeChanges`, `addEdge`, `reconnectEdge`
- **Enums** — `Position`, `MarkerType`, `ConnectionMode`, `ConnectionLineType`, `PanOnScrollMode`
- **Types** — `Node`, `Edge`, `Connection`, `NodeChange`, `EdgeChange`, `NodeProps`,
  `EdgeProps`, `OnConnect`, `ReactFlowInstance`, `Viewport`, `ReactFlowProps`, and more

Custom `nodeTypes` / `edgeTypes`, `onConnect`, and the `<Handle type position>`
API all keep working. Coverage targets the common migration surface — see the
[migration guide](https://github.com/olbboy/realflow/blob/main/docs/migration.md)
for the exact map and the few APIs that need manual attention.

## Why migrate?

Once you're on the RealFlow engine you get, without changing your app code:

- **Undo / redo** — transactional, drag-coalescing (`⌘Z` / `⌘⇧Z`)
- **Viewport culling** — spatial-hash backed, on by default (large graphs stay interactive)
- **Zero-render pan/zoom** — the viewport transform is written straight to the DOM

When you're ready, drop the compat layer and adopt the native, less-boilerplate
[`@realflow/react`](https://www.npmjs.com/package/@realflow/react) API
(`useRealFlow()` — no `onNodesChange` / `applyNodeChanges` wiring).

## Related packages

| Package | What it is |
| --- | --- |
| [`@realflow/react`](https://www.npmjs.com/package/@realflow/react) | The native RealFlow React renderer |
| [`@realflow/core`](https://www.npmjs.com/package/@realflow/core) | Headless, zero-dependency engine |

## License

[MIT](https://github.com/olbboy/realflow/blob/main/LICENSE) © RealFlow contributors.
