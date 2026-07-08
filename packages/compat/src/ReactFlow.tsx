import { useContext, useEffect, useMemo, useRef } from 'react';
import {
  ReFlow,
  ReFlowProvider,
  FlowContext,
  useFlowStore,
  useNodeId,
  createApi,
  screenToFlow,
  flowToScreen,
  type Node as ReflowNode,
  type Edge as ReflowEdge,
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

const toReflowNode = (n: RFNode): ReflowNode => ({
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

const toReflowEdge = (e: RFEdge): ReflowEdge => ({
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

const fromReflowNode = (n: ReflowNode): RFNode => ({ ...n, data: n.data } as unknown as RFNode);
const fromReflowEdge = (e: ReflowEdge): RFEdge => ({ ...e } as unknown as RFEdge);

/** Wrap a React Flow node component so it receives RF-style NodeProps. */
function wrapNodeType(RFComp: React.ComponentType<NodeProps<any>>): React.ComponentType<any> {
  return function CompatNode(reflowProps: {
    id: string;
    data: any;
    node: ReflowNode;
    selected: boolean;
    dragging: boolean;
  }) {
    const store = useFlowStore();
    const abs = store.absolutePosition(reflowProps.id);
    const size = store.nodeSize(reflowProps.id);
    return (
      <RFComp
        id={reflowProps.id}
        data={reflowProps.data}
        type={reflowProps.node.type}
        selected={reflowProps.selected}
        dragging={reflowProps.dragging}
        isConnectable={reflowProps.node.connectable !== false}
        positionAbsoluteX={abs.x}
        positionAbsoluteY={abs.y}
        width={size.width}
        height={size.height}
      />
    );
  };
}

/** Diff two node arrays into React Flow change objects. */
function diffNodes(prev: Map<string, ReflowNode>, next: ReflowNode[]): NodeChange[] {
  const changes: NodeChange[] = [];
  const nextIds = new Set<string>();
  for (const n of next) {
    nextIds.add(n.id);
    const p = prev.get(n.id);
    if (!p) {
      changes.push({ type: 'add', item: fromReflowNode(n) });
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

function diffEdges(prev: Map<string, ReflowEdge>, next: ReflowEdge[]): EdgeChange[] {
  const changes: EdgeChange[] = [];
  const nextIds = new Set<string>();
  for (const e of next) {
    nextIds.add(e.id);
    const p = prev.get(e.id);
    if (!p) {
      changes.push({ type: 'add', item: fromReflowEdge(e) });
      continue;
    }
    if (!!p.selected !== !!e.selected) changes.push({ type: 'select', id: e.id, selected: !!e.selected });
  }
  for (const id of prev.keys()) if (!nextIds.has(id)) changes.push({ type: 'remove', id });
  return changes;
}

export function ReactFlowProvider({ children }: { children: React.ReactNode }) {
  return <ReFlowProvider>{children}</ReFlowProvider>;
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

  const reflowNodes = useMemo(
    () => (nodes ?? defaultNodes)?.map(toReflowNode),
    [nodes, defaultNodes]
  );
  const reflowEdges = useMemo(
    () => (edges ?? defaultEdges)?.map(toReflowEdge),
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
    <ReFlow
      defaultNodes={controlled ? undefined : reflowNodes}
      defaultEdges={controlled ? undefined : reflowEdges}
      nodes={controlled ? reflowNodes : undefined}
      edges={controlled ? reflowEdges : undefined}
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
      onNodeClick={onNodeClick ? (e, n) => onNodeClick(e, fromReflowNode(n)) : undefined}
      onEdgeClick={onEdgeClick ? (e, edge) => onEdgeClick(e, fromReflowEdge(edge)) : undefined}
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
    </ReFlow>
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
  const prevNodes = useRef(new Map<string, ReflowNode>());
  const prevEdges = useRef(new Map<string, ReflowEdge>());
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
        nodes: [...store.selectedNodes].map((id) => fromReflowNode(store.getNode(id)!)).filter(Boolean),
        edges: [...store.selectedEdges].map((id) => fromReflowEdge(store.getEdge(id)!)).filter(Boolean),
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
      return n ? fromReflowNode(n) : undefined;
    },
    getNodes: () => store.getNodes().map(fromReflowNode),
    getEdge: (id) => {
      const e = store.getEdge(id);
      return e ? fromReflowEdge(e) : undefined;
    },
    getEdges: () => store.getEdges().map(fromReflowEdge),
    setNodes: (payload) => {
      const cur = store.getNodes().map(fromReflowNode);
      const next = typeof payload === 'function' ? payload(cur) : payload;
      store.setGraph(next.map(toReflowNode), store.getEdges());
    },
    setEdges: (payload) => {
      const cur = store.getEdges().map(fromReflowEdge);
      const next = typeof payload === 'function' ? payload(cur) : payload;
      store.setGraph(store.getNodes(), next.map(toReflowEdge));
    },
    addNodes: (payload) => {
      const arr = Array.isArray(payload) ? payload : [payload];
      store.addNodes(arr.map(toReflowNode));
    },
    addEdges: (payload) => {
      const arr = Array.isArray(payload) ? payload : [payload];
      store.addEdges(arr.map(toReflowEdge));
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
        nodes: snap.nodes.map(fromReflowNode),
        edges: snap.edges.map(fromReflowEdge),
        viewport: snap.viewport,
      };
    },
  };
}

/** React Flow's useReactFlow hook. */
export function useReactFlow(): ReactFlowInstance {
  const store = useContext(FlowContext);
  if (!store) {
    throw new Error('[reflow/compat] useReactFlow must be used inside <ReactFlow> or <ReactFlowProvider>');
  }
  return useMemo(() => makeInstance(createApi(store)), [store]);
}

export { useNodeId };
