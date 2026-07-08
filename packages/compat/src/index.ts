/**
 * @realflow/compat — React Flow (xyflow) API compatibility layer.
 *
 * Migrate an existing React Flow app by changing the import:
 *
 *   - import { ReactFlow, Handle, Position, useReactFlow } from '@xyflow/react';
 *   + import { ReactFlow, Handle, Position, useReactFlow } from '@realflow/compat';
 *   - import '@xyflow/react/dist/style.css';
 *   + import '@realflow/compat/style.css';
 *
 * The adapter maps React Flow's controlled `onNodesChange(changes)` model,
 * `<Handle type position>`, `useReactFlow()`, `applyNodeChanges`,
 * `useNodesState`, `addEdge`, etc. onto ReFlow's engine. Coverage targets the
 * common migration surface — see docs/migration.md for the exact map and the
 * few APIs that need manual attention.
 */
export {
  Position,
  MarkerType,
  ConnectionMode,
  ConnectionLineType,
  PanOnScrollMode,
} from './enums';
export type {
  RFNode as Node,
  RFEdge as Edge,
  Connection,
  NodeChange,
  EdgeChange,
  NodeProps,
  EdgeProps,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  ReactFlowInstance,
  XYPosition,
  Viewport,
  ReactFlowProps,
} from './types';
export {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  reconnectEdge,
} from './changes';
export { useNodesState, useEdgesState } from './useNodesState';
export { Handle } from './Handle';
export { ReactFlow, ReactFlowProvider, useReactFlow } from './ReactFlow';

// These ReFlow components are already API-compatible with React Flow's.
export { Background, MiniMap, Controls, Panel } from '@realflow/react';
// React Flow also ships these; the ReFlow versions have equivalent behavior.
export { NodeResizer, NodeToolbar } from '@realflow/react';
// React Flow-compatible selection hook.
export { useOnSelectionChange } from '@realflow/react';
