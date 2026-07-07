import {
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { FlowStore, rectFromPoints, screenToFlow } from '@reflow/core';
import type { Edge, Node, Viewport, XY } from '@reflow/core';
import { FlowContext } from './context';
import { ConfigContext, ContainerContext } from './config';
import { MeasureContext, createMeasurer } from './measure';
import { createApi } from './hooks';
import { NodesLayer, builtinNodeTypes } from './NodeRenderer';
import { EdgesLayer } from './EdgeRenderer';
import type { FlowConfig, ReFlowProps } from './types';

interface PaneSession {
  pointerId: number;
  mode: 'pan' | 'box';
  startClient: XY;
  startViewport: Viewport;
  startFlow: XY;
  moved: boolean;
  raf: number | null;
  lastClient: XY;
}

const INPUT_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

/**
 * Standalone provider for using ReFlow hooks outside the <ReFlow> canvas
 * (toolbars, sidebars, inspectors).
 */
export const ReFlowProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [store] = useState(() => new FlowStore());
  return <FlowContext.Provider value={store}>{children}</FlowContext.Provider>;
};

/** The ReFlow canvas. */
export const ReFlow = memo(function ReFlow(props: ReFlowProps) {
  const {
    nodes,
    edges,
    defaultNodes,
    defaultEdges,
    onNodesChange,
    onEdgesChange,
    onSelectionChange,
    onConnect,
    onNodeClick,
    onNodeDoubleClick,
    onNodeContextMenu,
    onEdgeClick,
    onPaneClick,
    onPaneContextMenu,
    onInit,
    nodeTypes,
    edgeTypes,
    fitViewOnInit = true,
    fitViewOptions,
    defaultViewport,
    minZoom = 0.1,
    maxZoom = 2.5,
    snapGrid = 0,
    alignmentGuides = true,
    preventCycles = false,
    allowDuplicateEdges = false,
    validateConnection,
    defaultEdgeOptions,
    historyLimit,
    readOnly = false,
    panOnDrag = true,
    panOnScroll = false,
    zoomOnScroll = true,
    zoomOnDoubleClick = true,
    selectionOnDrag = false,
    deleteKey = true,
    keyboardShortcuts = true,
    colorMode = 'auto',
    className,
    style,
    children,
  } = props;

  const parentStore = useContext(FlowContext);
  const [ownStore] = useState(
    () =>
      parentStore ??
      new FlowStore({
        nodes: nodes ?? defaultNodes ?? [],
        edges: edges ?? defaultEdges ?? [],
        viewport: defaultViewport,
      })
  );
  const store = parentStore ?? ownStore;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pane = useRef<PaneSession | null>(null);
  /** Active touch pointers on the pane; two of them = pinch zoom. */
  const touches = useRef(new Map<number, XY>());
  const pinch = useRef<{ startDist: number; startZoom: number; startFlowMid: XY } | null>(null);
  const [boxRect, setBoxRect] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const seeded = useRef(false);
  const clipboard = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const pasteCount = useRef(0);

  // Keep store options in sync with props (mutable by design).
  store.options = {
    ...store.options,
    minZoom,
    maxZoom,
    snapGrid,
    alignmentGuides,
    preventCycles,
    allowDuplicateEdges,
    validateConnection,
    defaultEdgeOptions,
    historyLimit,
  };

  // Latest event callbacks without re-rendering the tree.
  const cbs = useRef({
    onConnect,
    onNodeClick,
    onNodeDoubleClick,
    onNodeContextMenu,
    onEdgeClick,
    onPaneClick,
    onPaneContextMenu,
    onNodesChange,
    onEdgesChange,
    onSelectionChange,
  });
  cbs.current = {
    onConnect,
    onNodeClick,
    onNodeDoubleClick,
    onNodeContextMenu,
    onEdgeClick,
    onPaneClick,
    onPaneContextMenu,
    onNodesChange,
    onEdgesChange,
    onSelectionChange,
  };

  const config = useMemo<FlowConfig>(
    () => ({
      nodeTypes: { ...builtinNodeTypes, ...nodeTypes },
      edgeTypes: edgeTypes ?? {},
      readOnly,
      onConnect: (edge) => cbs.current.onConnect?.(edge),
      onNodeClick: (e, n) => cbs.current.onNodeClick?.(e, n),
      onNodeDoubleClick: (e, n) => cbs.current.onNodeDoubleClick?.(e, n),
      onNodeContextMenu: cbs.current.onNodeContextMenu
        ? (e, n) => cbs.current.onNodeContextMenu?.(e, n)
        : undefined,
      onEdgeClick: (e, edge) => cbs.current.onEdgeClick?.(e, edge),
    }),
    [nodeTypes, edgeTypes, readOnly]
  );

  // ── controlled-mode sync ────────────────────────────────────────────────
  const lastNodes = useRef<Node[] | null>(null);
  const lastEdges = useRef<Edge[] | null>(null);
  useEffect(() => {
    const nodesChanged = nodes && nodes !== lastNodes.current;
    const edgesChanged = edges && edges !== lastEdges.current;
    if (nodesChanged || edgesChanged) {
      store.setGraph(nodes ?? store.getNodes(), edges ?? store.getEdges());
      if (nodes) lastNodes.current = nodes;
      if (edges) lastEdges.current = edges;
    }
  }, [store, nodes, edges]);

  useEffect(() => {
    const unsubs = [
      store.subscribe('commit', () => {
        if (cbs.current.onNodesChange) {
          const ns = store.getNodes();
          lastNodes.current = ns;
          cbs.current.onNodesChange(ns);
        }
        if (cbs.current.onEdgesChange) {
          const es = store.getEdges();
          lastEdges.current = es;
          cbs.current.onEdgesChange(es);
        }
      }),
      store.subscribe('selection', () => {
        cbs.current.onSelectionChange?.({
          nodes: [...store.selectedNodes],
          edges: [...store.selectedEdges],
        });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [store]);

  // ── init: seed provider store, measure, fit ────────────────────────────
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (parentStore && store.nodes.size === 0 && (defaultNodes || nodes)) {
      store.setGraph(nodes ?? defaultNodes ?? [], edges ?? defaultEdges ?? []);
      if (nodes) lastNodes.current = nodes;
      if (edges) lastEdges.current = edges;
    }
    if (defaultViewport && parentStore) store.setViewport(defaultViewport);
    // Wait two frames so nodes get measured before fitting.
    if (fitViewOnInit) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => store.fitView({ padding: 0.12, ...fitViewOptions }))
      );
    }
    onInit?.(createApi(store));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── container size tracking ─────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    store.setScreenSize(el.clientWidth, el.clientHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      store.setScreenSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [store]);

  // ── viewport transform: direct DOM, zero React re-renders ──────────────
  useEffect(() => {
    const apply = (): void => {
      const el = viewportRef.current;
      if (!el) return;
      const { x, y, zoom } = store.viewport;
      el.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
      // Level-of-detail hint: CSS hides fine details when zoomed far out.
      const container = containerRef.current;
      if (container) {
        const lod = zoom < 0.35 ? '1' : '0';
        if (container.dataset.rfLod !== lod) container.dataset.rfLod = lod;
      }
    };
    apply();
    return store.subscribe('viewport', apply);
  }, [store]);

  // One shared ResizeObserver for all nodes in this flow.
  const measurer = useMemo(() => createMeasurer(store), [store]);
  useEffect(() => () => measurer.disconnect(), [measurer]);

  // ── wheel zoom (non-passive so we can preventDefault) ──────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      let dy = e.deltaY;
      let dx = e.deltaX;
      if (e.deltaMode === 1) {
        dy *= 16;
        dx *= 16;
      }
      if (panOnScroll && !e.ctrlKey && !e.metaKey) {
        // Figma-style: scroll pans, pinch/ctrl+scroll zooms.
        e.preventDefault();
        store.panBy(-dx, -dy);
        return;
      }
      if (!zoomOnScroll && !e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pivot = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const factor = Math.exp(-dy * (e.ctrlKey ? 0.0075 : 0.002));
      store.zoomBy(factor, pivot);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [store, zoomOnScroll, panOnScroll]);

  // ── pane interactions: pan, box-select, click ───────────────────────────
  const clientToFlow = (clientX: number, clientY: number): XY => {
    const rect = containerRef.current?.getBoundingClientRect();
    return screenToFlow(
      { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) },
      store.viewport
    );
  };

  const containerPoint = (clientX: number, clientY: number): XY => {
    const rect = containerRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };

  const beginPinch = (): void => {
    const pts = [...touches.current.values()];
    if (pts.length < 2) return;
    pane.current = null; // pinch cancels pan/box-select
    setBoxRect(null);
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    pinch.current = {
      startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
      startZoom: store.viewport.zoom,
      startFlowMid: screenToFlow(mid, store.viewport),
    };
  };

  const movePinch = (): void => {
    const p = pinch.current;
    const pts = [...touches.current.values()];
    if (!p || pts.length < 2) return;
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const minZoom = store.options.minZoom ?? 0.1;
    const maxZoom = store.options.maxZoom ?? 2.5;
    const zoom = Math.min(maxZoom, Math.max(minZoom, p.startZoom * (dist / p.startDist)));
    // Keep the flow point that started under the fingers' midpoint anchored.
    store.setViewport({
      x: mid.x - p.startFlowMid.x * zoom,
      y: mid.y - p.startFlowMid.y * zoom,
      zoom,
    });
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    containerRef.current?.focus({ preventScroll: true });
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, containerPoint(e.clientX, e.clientY));
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events */
      }
      if (touches.current.size === 2) {
        beginPinch();
        return;
      }
      if (touches.current.size > 2) return;
    }
    if (e.button !== 0 && e.button !== 1) return;
    const wantBox =
      !readOnly && e.button === 0 && (selectionOnDrag ? !e.altKey : e.shiftKey);
    const wantPan = !wantBox && panOnDrag !== false;
    if (!wantBox && !wantPan) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events or lost pointers: proceed uncaptured */
    }
    pane.current = {
      pointerId: e.pointerId,
      mode: wantBox ? 'box' : 'pan',
      startClient: { x: e.clientX, y: e.clientY },
      startViewport: { ...store.viewport },
      startFlow: clientToFlow(e.clientX, e.clientY),
      moved: false,
      raf: null,
      lastClient: { x: e.clientX, y: e.clientY },
    };
    if (wantBox) setBoxRect(null);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, containerPoint(e.clientX, e.clientY));
      if (pinch.current) {
        movePinch();
        return;
      }
    }
    const s = pane.current;
    if (!s || e.pointerId !== s.pointerId) return;
    s.lastClient = { x: e.clientX, y: e.clientY };
    const dx = e.clientX - s.startClient.x;
    const dy = e.clientY - s.startClient.y;
    if (!s.moved && Math.hypot(dx, dy) < 3) return;
    s.moved = true;
    if (s.raf != null) return;
    s.raf = requestAnimationFrame(() => {
      s.raf = null;
      if (pane.current !== s) return;
      const ddx = s.lastClient.x - s.startClient.x;
      const ddy = s.lastClient.y - s.startClient.y;
      if (s.mode === 'pan') {
        store.setViewport({
          x: s.startViewport.x + ddx,
          y: s.startViewport.y + ddy,
          zoom: s.startViewport.zoom,
        });
      } else {
        const from = s.startFlow;
        const to = clientToFlow(s.lastClient.x, s.lastClient.y);
        const rect = rectFromPoints(from, to);
        store.setSelection(store.nodesInRect(rect));
        const cr = containerRef.current!.getBoundingClientRect();
        setBoxRect({
          x: Math.min(s.startClient.x, s.lastClient.x) - cr.left,
          y: Math.min(s.startClient.y, s.lastClient.y) - cr.top,
          w: Math.abs(ddx),
          h: Math.abs(ddy),
        });
      }
    });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId);
      if (pinch.current) {
        // End pinch; the remaining finger must lift and re-touch to pan
        // (prevents a jump when one finger leaves).
        if (touches.current.size < 2) pinch.current = null;
        return;
      }
    }
    const s = pane.current;
    if (!s || e.pointerId !== s.pointerId) return;
    pane.current = null;
    if (s.raf != null) cancelAnimationFrame(s.raf);
    setBoxRect(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (!s.moved && e.button === 0) {
      // Pane click: clear selection (keep it with shift) and notify.
      if (!e.shiftKey && !readOnly) {
        store.cancelConnection();
        store.clearSelection();
      }
      cbs.current.onPaneClick?.(e as unknown as ReactMouseEvent, clientToFlow(e.clientX, e.clientY));
    }
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>): void => {
    if (!zoomOnDoubleClick) return;
    const rect = containerRef.current!.getBoundingClientRect();
    store.zoomBy(1.5, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const onContextMenu = (e: ReactMouseEvent<HTMLDivElement>): void => {
    if (cbs.current.onPaneContextMenu) {
      e.preventDefault();
      cbs.current.onPaneContextMenu(e, clientToFlow(e.clientX, e.clientY));
    }
  };

  // ── keyboard shortcuts ──────────────────────────────────────────────────
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (!keyboardShortcuts || readOnly) return;
    if ((e.target as Element).closest(INPUT_SELECTOR)) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key;
    if (deleteKey && (key === 'Delete' || key === 'Backspace')) {
      e.preventDefault();
      store.deleteSelection();
    } else if (mod && !e.shiftKey && key.toLowerCase() === 'z') {
      e.preventDefault();
      store.undo();
    } else if ((mod && e.shiftKey && key.toLowerCase() === 'z') || (mod && key.toLowerCase() === 'y')) {
      e.preventDefault();
      store.redo();
    } else if (mod && key.toLowerCase() === 'a') {
      e.preventDefault();
      store.selectAll();
    } else if (mod && key.toLowerCase() === 'c') {
      if (store.selectedNodes.size > 0) clipboard.current = store.copy();
    } else if (mod && key.toLowerCase() === 'v') {
      if (clipboard.current) {
        e.preventDefault();
        // Offset each paste so repeated pastes cascade.
        pasteCount.current += 1;
        const d = 24 * pasteCount.current;
        store.paste(clipboard.current, { x: d, y: d });
      }
    } else if (mod && key.toLowerCase() === 'd') {
      if (store.selectedNodes.size > 0) {
        e.preventDefault();
        store.duplicateSelection();
      }
    } else if (mod && key.toLowerCase() === 'x') {
      if (store.selectedNodes.size > 0) {
        clipboard.current = store.copy();
        pasteCount.current = 0;
        store.deleteSelection();
      }
    } else if (key === 'Escape') {
      store.cancelConnection();
      store.clearSelection();
    } else if (e.altKey && key.startsWith('Arrow') && store.selectedNodes.size > 0) {
      // Alt+Arrow: spatially navigate the selection to the nearest node.
      e.preventDefault();
      const from = [...store.selectedNodes][0];
      const dir =
        key === 'ArrowLeft' ? 'left' : key === 'ArrowRight' ? 'right' : key === 'ArrowUp' ? 'up' : 'down';
      const next = store.nearestNodeInDirection(from, dir);
      if (next) {
        store.setSelection([next]);
        store.centerNode(next, 200);
        const el = containerRef.current?.querySelector<HTMLElement>(`.rf-node[data-id="${next}"]`);
        el?.focus({ preventScroll: true });
      }
    } else if (key.startsWith('Arrow') && store.selectedNodes.size > 0) {
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1) * Math.max(1, snapGrid);
      const d: XY =
        key === 'ArrowLeft'
          ? { x: -step, y: 0 }
          : key === 'ArrowRight'
            ? { x: step, y: 0 }
            : key === 'ArrowUp'
              ? { x: 0, y: -step }
              : { x: 0, y: step };
      store.transact('nudge', () => {
        for (const id of store.selectedNodes) {
          const n = store.getNode(id);
          if (n && n.draggable !== false) {
            store.setNodePosition(id, { x: n.position.x + d.x, y: n.position.y + d.y });
          }
        }
      });
    }
  };

  return (
    <FlowContext.Provider value={store}>
      <ConfigContext.Provider value={config}>
        <ContainerContext.Provider value={containerRef}>
          <div
            ref={containerRef}
            className={`rf-container${className ? ` ${className}` : ''}`}
            style={style}
            data-rf-theme={colorMode !== 'auto' ? colorMode : undefined}
            tabIndex={0}
            role="application"
            aria-label="Flow canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            onKeyDown={onKeyDown}
          >
            <MeasureContext.Provider value={measurer}>
              <div ref={viewportRef} className="rf-viewport">
                <EdgesLayer />
                <NodesLayer />
              </div>
            </MeasureContext.Provider>
            {boxRect ? (
              <div
                className="rf-selection-box"
                style={{ left: boxRect.x, top: boxRect.y, width: boxRect.w, height: boxRect.h }}
              />
            ) : null}
            {children}
          </div>
        </ContainerContext.Provider>
      </ConfigContext.Provider>
    </FlowContext.Provider>
  );
});
