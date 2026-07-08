import { useContext, useEffect, useMemo, useRef } from 'react';
import {
  RealFlow,
  RealFlowProvider,
  FlowContext,
  useFlowStore,
  useNodeId,
  createApi,
  screenToFlow,
  flowToScreen,
  type Node as RealFlowNode,
  type Edge as RealFlowEdge,
} from '@realflow/react';
import type {
  NodeChange,
  EdgeChange,
  NodeProps,
  ReactFlowInstance,
  ReactFlowProps,
  RFEdge,
  RFNode,
} from './types';

const toRealFlowNode = (n: RFNode): RealFlowNode => ({
  id: n.id,
  position: n.position,
  data: n.data ?? {},
  type: n.type,
  hidden: n.hidden,
  selected: n.selected,
  draggable: n.draggable,
  selectable: n.selectable,
  connectable: n.connectable,
  deletable: n.deletable,
  width: n.width,
  height: n.height,
  parentId: n.parentId,
  extent: n.extent,
  zIndex: n.zIndex,
  style: n.style as Record<string, string | number> | undefined,
  className: n.className,
});

const toRealFlowEdge = (e: RFEdge): RealFlowEdge => ({
  id: e.id,
  source: e.source,
  target: e.target,
  sourceHandle: e.sourceHandle ?? undefined,
  targetHandle: e.targetHandle ?? undefined,
  type: e.type,
  label: e.label,
  animated: e.animated,
  selected: e.selected,
  hidden: e.hidden,
  deletable: e.deletable,
  data: e.data,
  markerStart: e.markerStart,
  markerEnd: e.markerEnd,
  style: e.style as Record<string, string | number> | undefined,
  className: e.className,
});

const fromRealFlowNode = (n: RealFlowNode): RFNode => ({ ...n, data: n.data } as unknown as RFNode);
const fromRealFlowEdge = (e: RealFlowEdge): RFEdge => ({ ...e } as unknown as RFEdge);

/** Wrap a React Flow node component so it receives RF-style NodeProps. */
function wrapNodeType(RFComp: React.ComponentType<NodeProps<any>>): React.ComponentType<any> {
  return function CompatNode(realflowProps: {
    id: string;
    data: any;
    node: RealFlowNode;
    selected: boolean;
    dragging: boolean;
  }) {
    const store = useFlowStore();
    const abs = store.absolutePosition(realflowProps.id);
    const size = store.nodeSize(realflowProps.id);
    return (
      <RFComp
        id={realflowProps.id}
        data={realflowProps.data}
        type={realflowProps.node.type}
        selected={realflowProps.selected}
        dragging={realflowProps.dragging}
        isConnectable={realflowProps.node.connectable !== false}
        positionAbsoluteX={abs.x}
        positionAbsoluteY={abs.y}
        width={size.width}
        height={size.height}
      />
    );
  };
}

/** Diff two node arrays into React Flow change objects. */
function diffNodes(prev: Map<string, RealFlowNode>, next: RealFlowNode[]): NodeChange[] {
  const changes: NodeChange[] = [];
  const nextIds = new Set<string>();
  for (const n of next) {
    nextIds.add(n.id);
    const p = prev.get(n.id);
    if (!p) {
      changes.push({ type: 'add', item: fromRealFlowNode(n) });
      continue;
    }
    if (p.position.x !== n.position.x || p.position.y !== n.position.y) {
      changes.push({ type: 'position', id: n.id, position: { ...n.position }, dragging: false });
    }
    if (!!p.selected !== !!n.selected) {
      changes.push({ type: 'select', id: n.id, selected: !!n.selected });
    }
  }
  for (const id of prev.keys()) if (!nextIds.has(id)) changes.push({ type: 'remove', id });
  return changes;
}

function diffEdges(prev: Map<string, RealFlowEdge>, next: RealFlowEdge[]): EdgeChange[] {
  const changes: EdgeChange[] = [];
  const nextIds = new Set<string>();
  for (const e of next) {
    nextIds.add(e.id);
    const p = prev.get(e.id);
    if (!p) {
      changes.push({ type: 'add', item: fromRealFlowEdge(e) });
      continue;
    }
    if (!!p.selected !== !!e.selected) changes.push({ type: 'select', id: e.id, selected: !!e.selected });
  }
  for (const id of prev.keys()) if (!nextIds.has(id)) changes.push({ type: 'remove', id });
  return changes;
}

export function ReactFlowProvider({ children }: { children: React.ReactNode }) {
  return <RealFlowProvider>{children}</RealFlowProvider>;
}

/**
 * React Flow-compatible `<ReactFlow>`. Supports controlled
 * (nodes/edges + onNodesChange/onEdgesChange) and uncontrolled
 * (defaultNodes/defaultEdges) usage, custom nodeTypes, onConnect, onInit.
 */
export function ReactFlow(props: ReactFlowProps) {
  const {
    nodes,
    edges,
    defaultNodes,
    defaultEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onInit,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
    onSelectionChange,
    nodeTypes,
    fitView,
    fitViewOptions,
    minZoom,
    maxZoom,
    defaultViewport,
    snapToGrid,
    snapGrid,
    panOnDrag,
    panOnScroll,
    zoomOnScroll,
    zoomOnDoubleClick,
    selectionOnDrag,
    connectionMode,
    colorMode,
    defaultEdgeOptions,
    className,
    style,
    children,
  } = props;

  const realflowNodes = useMemo(
    () => (nodes ?? defaultNodes)?.map(toRealFlowNode),
    [nodes, defaultNodes]
  );
  const realflowEdges = useMemo(
    () => (edges ?? defaultEdges)?.map(toRealFlowEdge),
    [edges, defaultEdges]
  );
  const controlled = nodes != null;

  const wrappedNodeTypes = useMemo(() => {
    if (!nodeTypes) return undefined;
    const out: Record<string, React.ComponentType<any>> = {};
    for (const [k, C] of Object.entries(nodeTypes)) out[k] = wrapNodeType(C);
    return out;
  }, [nodeTypes]);

  const cbs = useRef({ onNodesChange, onEdgesChange, onConnect, onSelectionChange });
  cbs.current = { onNodesChange, onEdgesChange, onConnect, onSelectionChange };

  return (
    <RealFlow
      defaultNodes={controlled ? undefined : realflowNodes}
      defaultEdges={controlled ? undefined : realflowEdges}
      nodes={controlled ? realflowNodes : undefined}
      edges={controlled ? realflowEdges : undefined}
      nodeTypes={wrappedNodeTypes}
      fitViewOnInit={fitView}
      fitViewOptions={fitViewOptions}
      minZoom={minZoom}
      maxZoom={maxZoom}
      defaultViewport={defaultViewport}
      snapGrid={snapToGrid ? snapGrid?.[0] ?? 15 : 0}
      panOnDrag={Array.isArray(panOnDrag) ? true : panOnDrag}
      panOnScroll={panOnScroll}
      zoomOnScroll={zoomOnScroll}
      zoomOnDoubleClick={zoomOnDoubleClick}
      selectionOnDrag={selectionOnDrag}
      allowDuplicateEdges={connectionMode === 'loose'}
      colorMode={colorMode === 'system' ? 'auto' : colorMode}
      defaultEdgeOptions={defaultEdgeOptions as never}
      className={className}
      style={style}
      onConnect={(edge) => cbs.current.onConnect?.({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
      })}
      onNodeClick={onNodeClick ? (e, n) => onNodeClick(e, fromRealFlowNode(n)) : undefined}
      onEdgeClick={onEdgeClick ? (e, edge) => onEdgeClick(e, fromRealFlowEdge(edge)) : undefined}
      onPaneClick={onPaneClick ? (e) => onPaneClick(e) : undefined}
      onInit={(api) => {
        onInit?.(makeInstance(api));
      }}
    >
      <ChangeBridge
        onNodesChange={(c) => cbs.current.onNodesChange?.(c)}
        onEdgesChange={(c) => cbs.current.onEdgesChange?.(c)}
        onSelectionChange={(s) => cbs.current.onSelectionChange?.(s)}
      />
      {children}
    </RealFlow>
  );
}

/** Subscribes to the store and emits React Flow change objects on commits. */
function ChangeBridge({
  onNodesChange,
  onEdgesChange,
  onSelectionChange,
}: {
  onNodesChange: (c: NodeChange[]) => void;
  onEdgesChange: (c: EdgeChange[]) => void;
  onSelectionChange: (s: { nodes: RFNode[]; edges: RFEdge[] }) => void;
}) {
  const store = useFlowStore();
  const prevNodes = useRef(new Map<string, RealFlowNode>());
  const prevEdges = useRef(new Map<string, RealFlowEdge>());
  const cb = useRef({ onNodesChange, onEdgesChange, onSelectionChange });
  cb.current = { onNodesChange, onEdgesChange, onSelectionChange };

  useEffect(() => {
    prevNodes.current = new Map(store.getNodes().map((n) => [n.id, n]));
    prevEdges.current = new Map(store.getEdges().map((e) => [e.id, e]));
    const unsub = store.subscribe('commit', () => {
      const nodes = store.getNodes();
      const nChanges = diffNodes(prevNodes.current, nodes);
      if (nChanges.length) cb.current.onNodesChange(nChanges);
      prevNodes.current = new Map(nodes.map((n) => [n.id, n]));

      const edges = store.getEdges();
      const eChanges = diffEdges(prevEdges.current, edges);
      if (eChanges.length) cb.current.onEdgesChange(eChanges);
      prevEdges.current = new Map(edges.map((e) => [e.id, e]));
    });
    const unsubSel = store.subscribe('selection', () => {
      cb.current.onSelectionChange({
        nodes: [...store.selectedNodes].map((id) => fromRealFlowNode(store.getNode(id)!)).filter(Boolean),
        edges: [...store.selectedEdges].map((id) => fromRealFlowEdge(store.getEdge(id)!)).filter(Boolean),
      });
    });
    return () => {
      unsub();
      unsubSel();
    };
  }, [store]);
  return null;
}

function makeInstance(api: ReturnType<typeof createApi>): ReactFlowInstance {
  const store = api.store;
  return {
    getNode: (id) => {
      const n = store.getNode(id);
      return n ? fromRealFlowNode(n) : undefined;
    },
    getNodes: () => store.getNodes().map(fromRealFlowNode),
    getEdge: (id) => {
      const e = store.getEdge(id);
      return e ? fromRealFlowEdge(e) : undefined;
    },
    getEdges: () => store.getEdges().map(fromRealFlowEdge),
    setNodes: (payload) => {
      const cur = store.getNodes().map(fromRealFlowNode);
      const next = typeof payload === 'function' ? payload(cur) : payload;
      store.setGraph(next.map(toRealFlowNode), store.getEdges());
    },
    setEdges: (payload) => {
      const cur = store.getEdges().map(fromRealFlowEdge);
      const next = typeof payload === 'function' ? payload(cur) : payload;
      store.setGraph(store.getNodes(), next.map(toRealFlowEdge));
    },
    addNodes: (payload) => {
      const arr = Array.isArray(payload) ? payload : [payload];
      store.addNodes(arr.map(toRealFlowNode));
    },
    addEdges: (payload) => {
      const arr = Array.isArray(payload) ? payload : [payload];
      store.addEdges(arr.map(toRealFlowEdge));
    },
    deleteElements: ({ nodes: dn, edges: de }) => {
      store.transact('delete', () => {
        if (de) store.removeEdges(de.map((e) => e.id));
        if (dn) store.removeNodes(dn.map((n) => n.id));
      });
    },
    fitView: (opts) => api.fitView(opts as never),
    zoomIn: () => api.zoomIn(),
    zoomOut: () => api.zoomOut(),
    zoomTo: (zoom, opts) => api.zoomTo(zoom, opts?.duration),
    getZoom: () => store.viewport.zoom,
    setViewport: (vp, opts) => store.animateViewport(vp, opts?.duration ?? 0),
    getViewport: () => ({ ...store.viewport }),
    setCenter: (x, y, opts) => {
      const zoom = opts?.zoom ?? store.viewport.zoom;
      store.animateViewport(
        { x: store.screen.width / 2 - x * zoom, y: store.screen.height / 2 - y * zoom, zoom },
        opts?.duration ?? 0
      );
    },
    screenToFlowPosition: (p) => screenToFlow(p, store.viewport),
    flowToScreenPosition: (p) => flowToScreen(p, store.viewport),
    toObject: () => {
      const snap = store.toSnapshot();
      return {
        nodes: snap.nodes.map(fromRealFlowNode),
        edges: snap.edges.map(fromRealFlowEdge),
        viewport: snap.viewport,
      };
    },
  };
}

/** React Flow's useReactFlow hook. */
export function useReactFlow(): ReactFlowInstance {
  const store = useContext(FlowContext);
  if (!store) {
    throw new Error('[realflow/compat] useReactFlow must be used inside <ReactFlow> or <ReactFlowProvider>');
  }
  return useMemo(() => makeInstance(createApi(store)), [store]);
}

export { useNodeId };
