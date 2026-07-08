import type { ComponentType, CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type {
  ConnectionValidator,
  Edge,
  EdgeMarker,
  FitViewOptions,
  Node,
  Side,
  Viewport,
  XY,
} from '@realflow/core';
import type { RealFlowApi } from './hooks';

/** Props passed to custom node components. */
export interface NodeProps<T = Record<string, unknown>> {
  id: string;
  data: T;
  node: Node<T>;
  selected: boolean;
  dragging: boolean;
}

/** Props passed to custom edge components (geometry precomputed). */
export interface EdgeProps<T = Record<string, unknown>> {
  id: string;
  edge: Edge<T>;
  /** SVG path for the default routing of this edge's type. */
  path: string;
  labelX: number;
  labelY: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourceSide: Side;
  targetSide: Side;
  selected: boolean;
}

export type NodeTypes = Record<string, ComponentType<NodeProps<any>>>;
export type EdgeTypes = Record<string, ComponentType<EdgeProps<any>>>;

export interface RealFlowProps {
  /** Controlled nodes. Prefer `defaultNodes` + useRealFlow() for simple apps. */
  nodes?: Node[];
  edges?: Edge[];
  /** Uncontrolled initial graph. */
  defaultNodes?: Node[];
  defaultEdges?: Edge[];

  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onSelectionChange?: (selection: { nodes: string[]; edges: string[] }) => void;
  /** A user gesture created this edge. */
  onConnect?: (edge: Edge) => void;
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void;
  onNodeDoubleClick?: (event: ReactMouseEvent, node: Node) => void;
  onNodeContextMenu?: (event: ReactMouseEvent, node: Node) => void;
  onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void;
  onPaneClick?: (event: ReactMouseEvent, flowPosition: XY) => void;
  onPaneContextMenu?: (event: ReactMouseEvent, flowPosition: XY) => void;
  /** Called once with the imperative API (nice for refs-free setups). */
  onInit?: (api: RealFlowApi) => void;

  nodeTypes?: NodeTypes;
  edgeTypes?: EdgeTypes;

  /** Fit the view to the graph after mount. Default true. */
  fitViewOnInit?: boolean;
  fitViewOptions?: FitViewOptions;
  defaultViewport?: Viewport;

  minZoom?: number;
  maxZoom?: number;
  /** Snap dragging to a grid (px). 0 = off. */
  snapGrid?: number;
  /** Figma-style alignment guides while dragging. Default true. */
  alignmentGuides?: boolean;
  /** Reject connections that would create a directed cycle. */
  preventCycles?: boolean;
  /** Dynamic grouping: attach/detach a node to a `group` node on drag-drop. */
  reparentOnDrop?: boolean;
  allowDuplicateEdges?: boolean;
  validateConnection?: ConnectionValidator;
  defaultEdgeOptions?: Partial<Edge> & { markerEnd?: EdgeMarker };
  historyLimit?: number;

  /** Disable all interactions (view-only). */
  readOnly?: boolean;
  panOnDrag?: boolean;
  /** Figma-style trackpad mode: wheel/two-finger scroll pans, ctrl/cmd
   *  (or pinch gesture) zooms. Default false (wheel zooms). */
  panOnScroll?: boolean;
  zoomOnScroll?: boolean;
  zoomOnDoubleClick?: boolean;
  /** Box-select with plain drag instead of shift+drag. */
  selectionOnDrag?: boolean;
  /** Delete/Backspace removes selection. Default true. */
  deleteKey?: boolean;
  /** Built-in keyboard shortcuts (undo/redo/select-all/nudge). Default true. */
  keyboardShortcuts?: boolean;

  /** 'light' | 'dark' | 'auto' (default 'auto': follows prefers-color-scheme). */
  colorMode?: 'light' | 'dark' | 'auto';

  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export interface FlowConfig {
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
  readOnly: boolean;
  onConnect?: RealFlowProps['onConnect'];
  onNodeClick?: RealFlowProps['onNodeClick'];
  onNodeDoubleClick?: RealFlowProps['onNodeDoubleClick'];
  onNodeContextMenu?: RealFlowProps['onNodeContextMenu'];
  onEdgeClick?: RealFlowProps['onEdgeClick'];
}
