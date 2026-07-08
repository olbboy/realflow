import type { ComponentType, CSSProperties, ReactNode } from 'react';
import type { Edge as CoreEdge, Node as CoreNode, EdgeMarker } from '@realflow/core';
import type { Position } from './enums';

export interface XYPosition {
  x: number;
  y: number;
}
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** React Flow node shape. Superset-compatible with ReFlow's Node. */
export interface RFNode<T = any> {
  id: string;
  position: XYPosition;
  data: T;
  type?: string;
  sourcePosition?: Position;
  targetPosition?: Position;
  hidden?: boolean;
  selected?: boolean;
  draggable?: boolean;
  selectable?: boolean;
  connectable?: boolean;
  deletable?: boolean;
  width?: number;
  height?: number;
  parentId?: string;
  extent?: 'parent';
  zIndex?: number;
  style?: CSSProperties;
  className?: string;
  [key: string]: unknown;
}

export interface RFEdge<T = any> {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  label?: string;
  animated?: boolean;
  selected?: boolean;
  hidden?: boolean;
  deletable?: boolean;
  data?: T;
  markerStart?: EdgeMarker;
  markerEnd?: EdgeMarker;
  style?: CSSProperties;
  className?: string;
  [key: string]: unknown;
}

/** A would-be connection (React Flow's onConnect argument). */
export interface Connection {
  source: string | null;
  target: string | null;
  sourceHandle: string | null;
  targetHandle: string | null;
}

export type NodeChange<T = any> =
  | { type: 'position'; id: string; position?: XYPosition; dragging?: boolean }
  | { type: 'dimensions'; id: string; dimensions?: { width: number; height: number }; resizing?: boolean }
  | { type: 'select'; id: string; selected: boolean }
  | { type: 'remove'; id: string }
  | { type: 'add'; item: RFNode<T>; index?: number }
  | { type: 'replace'; id: string; item: RFNode<T> };

export type EdgeChange<T = any> =
  | { type: 'select'; id: string; selected: boolean }
  | { type: 'remove'; id: string }
  | { type: 'add'; item: RFEdge<T>; index?: number }
  | { type: 'replace'; id: string; item: RFEdge<T> };

export type OnNodesChange<T = any> = (changes: NodeChange<T>[]) => void;
export type OnEdgesChange<T = any> = (changes: EdgeChange<T>[]) => void;
export type OnConnect = (connection: Connection) => void;

/** React Flow's NodeProps passed to custom node components. */
export interface NodeProps<T = any> {
  id: string;
  data: T;
  type?: string;
  selected: boolean;
  dragging: boolean;
  isConnectable: boolean;
  positionAbsoluteX: number;
  positionAbsoluteY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  width?: number;
  height?: number;
}

export interface EdgeProps<T = any> {
  id: string;
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  data?: T;
  label?: string;
  selected: boolean;
  markerEnd?: string;
  markerStart?: string;
}

export interface ReactFlowInstance {
  getNode: (id: string) => RFNode | undefined;
  getNodes: () => RFNode[];
  getEdge: (id: string) => RFEdge | undefined;
  getEdges: () => RFEdge[];
  setNodes: (payload: RFNode[] | ((nds: RFNode[]) => RFNode[])) => void;
  setEdges: (payload: RFEdge[] | ((eds: RFEdge[]) => RFEdge[])) => void;
  addNodes: (payload: RFNode | RFNode[]) => void;
  addEdges: (payload: RFEdge | RFEdge[]) => void;
  deleteElements: (payload: { nodes?: { id: string }[]; edges?: { id: string }[] }) => void;
  fitView: (opts?: { padding?: number; duration?: number; nodes?: { id: string }[] }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (zoom: number, opts?: { duration?: number }) => void;
  getZoom: () => number;
  setViewport: (vp: Viewport, opts?: { duration?: number }) => void;
  getViewport: () => Viewport;
  setCenter: (x: number, y: number, opts?: { zoom?: number; duration?: number }) => void;
  screenToFlowPosition: (p: XYPosition) => XYPosition;
  flowToScreenPosition: (p: XYPosition) => XYPosition;
  toObject: () => { nodes: RFNode[]; edges: RFEdge[]; viewport: Viewport };
}

export interface ReactFlowProps {
  nodes?: RFNode[];
  edges?: RFEdge[];
  defaultNodes?: RFNode[];
  defaultEdges?: RFEdge[];
  onNodesChange?: OnNodesChange;
  onEdgesChange?: OnEdgesChange;
  onConnect?: OnConnect;
  onNodeClick?: (event: React.MouseEvent, node: RFNode) => void;
  onNodeDragStop?: (event: React.MouseEvent, node: RFNode) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: RFEdge) => void;
  onPaneClick?: (event: React.MouseEvent) => void;
  onInit?: (instance: ReactFlowInstance) => void;
  onSelectionChange?: (params: { nodes: RFNode[]; edges: RFEdge[] }) => void;
  nodeTypes?: Record<string, ComponentType<NodeProps<any>>>;
  edgeTypes?: Record<string, ComponentType<any>>;
  fitView?: boolean;
  fitViewOptions?: { padding?: number };
  minZoom?: number;
  maxZoom?: number;
  defaultViewport?: Viewport;
  snapToGrid?: boolean;
  snapGrid?: [number, number];
  nodesDraggable?: boolean;
  nodesConnectable?: boolean;
  elementsSelectable?: boolean;
  panOnDrag?: boolean | number[];
  panOnScroll?: boolean;
  zoomOnScroll?: boolean;
  zoomOnDoubleClick?: boolean;
  selectionOnDrag?: boolean;
  deleteKeyCode?: string | string[] | null;
  connectionMode?: string;
  colorMode?: 'light' | 'dark' | 'system';
  proOptions?: unknown;
  defaultEdgeOptions?: Partial<RFEdge>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export type { CoreNode, CoreEdge };
