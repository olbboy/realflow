import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type {
  ConnectionState,
  Edge,
  FitViewOptions,
  FlowSnapshot,
  FlowStore,
  LayoutOptions,
  LayoutType,
  Node,
  Viewport,
  XY,
} from '@reflow/core';
import { layout as coreLayout, screenToFlow, flowToScreen } from '@reflow/core';
import { useFlowStore } from './context';

/** Subscribe to one or more store topics and read a snapshot. */
export function useFlowSelector<T>(topics: string[], getSnapshot: () => T): T {
  const store = useFlowStore();
  const key = topics.join('|');
  const subscribe = useCallback(
    (cb: () => void) => {
      const unsubs = key.split('|').map((t) => store.subscribe(t, cb));
      return () => unsubs.forEach((u) => u());
    },
    [store, key]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Reactive node object (fine-grained: updates only when this node changes). */
export const useNode = <T = Record<string, unknown>>(id: string): Node<T> | undefined => {
  const store = useFlowStore();
  return useFlowSelector([`node:${id}`], () => store.nodes.get(id) as Node<T> | undefined);
};

/** Reactive edge object. */
export const useEdge = (id: string): Edge | undefined => {
  const store = useFlowStore();
  return useFlowSelector([`edge:${id}`], () => store.edges.get(id));
};

/**
 * All nodes, updated on structural changes and commits (not every drag
 * frame — subscribe to individual nodes for that).
 */
export const useNodes = (): Node[] => {
  const store = useFlowStore();
  const version = useFlowSelector(
    ['nodes', 'commit'],
    () => `${store.nodesVersion}:${store.commitVersion}`
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => store.getNodes(), [store, version]);
};

/** All edges (same update cadence as useNodes). */
export const useEdges = (): Edge[] => {
  const store = useFlowStore();
  const version = useFlowSelector(
    ['edges', 'commit'],
    () => `${store.edgesVersion}:${store.commitVersion}`
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => store.getEdges(), [store, version]);
};

/** Reactive viewport — re-renders on every pan/zoom frame. */
export const useViewport = (): Viewport => {
  const store = useFlowStore();
  return useFlowSelector(['viewport'], () => store.viewport);
};

/** Current selection as stable arrays. */
export const useSelection = (): { nodes: string[]; edges: string[] } => {
  const store = useFlowStore();
  const snap = useRef<{ key: string; value: { nodes: string[]; edges: string[] } } | undefined>(
    undefined
  );
  return useFlowSelector(['selection'], () => {
    const nodes = [...store.selectedNodes];
    const edges = [...store.selectedEdges];
    const key = `${nodes.join(',')}#${edges.join(',')}`;
    if (!snap.current || snap.current.key !== key) {
      snap.current = { key, value: { nodes, edges } };
    }
    return snap.current.value;
  });
};

/** Undo/redo availability (reactive) plus the actions. */
export const useHistory = (): {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
} => {
  const store = useFlowStore();
  const canUndo = useFlowSelector(['history'], () => store.canUndo);
  const canRedo = useFlowSelector(['history'], () => store.canRedo);
  return useMemo(
    () => ({
      canUndo,
      canRedo,
      undo: () => store.undo(),
      redo: () => store.redo(),
    }),
    [store, canUndo, canRedo]
  );
};

/** In-progress connection state (null when idle). */
export const useConnection = (): ConnectionState | null => {
  const store = useFlowStore();
  return useFlowSelector(['connection'], () => store.connection);
};

export interface ReflowApi {
  /** The underlying store, for anything not covered below. */
  store: FlowStore;
  addNode: (node: Node) => void;
  addNodes: (nodes: Node[]) => void;
  addEdge: (edge: Edge) => void;
  addEdges: (edges: Edge[]) => void;
  removeNodes: (ids: string[]) => void;
  removeEdges: (ids: string[]) => void;
  updateNode: (id: string, patch: Partial<Node>) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  updateEdge: (id: string, patch: Partial<Edge>) => void;
  getNode: (id: string) => Node | undefined;
  getEdge: (id: string) => Edge | undefined;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  connect: (candidate: { source: string; target: string; sourceHandle?: string; targetHandle?: string }, props?: Partial<Edge>) => Edge | null;
  setSelection: (nodes: string[], edges?: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;
  transact: (label: string, fn: () => void) => void;
  fitView: (opts?: FitViewOptions) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (zoom: number, duration?: number) => void;
  setViewport: (v: Viewport) => void;
  centerNode: (id: string, duration?: number) => void;
  layout: (type: LayoutType, opts?: LayoutOptions) => void;
  screenToFlow: (p: XY) => XY;
  flowToScreen: (p: XY) => XY;
  toSnapshot: () => FlowSnapshot;
  loadSnapshot: (snap: FlowSnapshot) => void;
}

/** Build the imperative API for a store (used by useReflow and onInit). */
export const createApi = (store: FlowStore): ReflowApi => ({
  store,
      addNode: (n) => store.addNode(n),
      addNodes: (ns) => store.addNodes(ns),
      addEdge: (e) => store.addEdge(e),
      addEdges: (es) => store.addEdges(es),
      removeNodes: (ids) => store.removeNodes(ids),
      removeEdges: (ids) => store.removeEdges(ids),
      updateNode: (id, patch) => store.updateNode(id, patch),
      updateNodeData: (id, patch) => store.updateNodeData(id, patch),
      updateEdge: (id, patch) => store.updateEdge(id, patch),
      getNode: (id) => store.getNode(id),
      getEdge: (id) => store.getEdge(id),
      getNodes: () => store.getNodes(),
      getEdges: () => store.getEdges(),
      connect: (c, props) => store.connect(c, props),
      setSelection: (nodes, edges = []) => store.setSelection(nodes, edges),
      selectAll: () => store.selectAll(),
      clearSelection: () => store.clearSelection(),
      deleteSelection: () => store.deleteSelection(),
      undo: () => store.undo(),
      redo: () => store.redo(),
      transact: (label, fn) => store.transact(label, fn),
      fitView: (opts) => store.fitView(opts),
      zoomIn: () => store.zoomBy(1.2),
      zoomOut: () => store.zoomBy(1 / 1.2),
      zoomTo: (z, d) => store.zoomTo(z, d),
      setViewport: (v) => store.setViewport(v),
      centerNode: (id, d) => store.centerNode(id, d),
      layout: (type, opts) => coreLayout(store, type, opts),
      screenToFlow: (p) => screenToFlow(p, store.viewport),
      flowToScreen: (p) => flowToScreen(p, store.viewport),
  toSnapshot: () => store.toSnapshot(),
  loadSnapshot: (snap) => store.loadSnapshot(snap),
});

/**
 * The one hook to drive a flow imperatively — no reducers, no change
 * handlers, no boilerplate.
 */
export const useReflow = (): ReflowApi => {
  const store = useFlowStore();
  return useMemo<ReflowApi>(() => createApi(store), [store]);
};
