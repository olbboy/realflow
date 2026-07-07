import { memo, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useFlowStore, NodeIdContext } from './context';
import { useConfig } from './config';
import { useFlowSelector } from './hooks';
import { useMeasurer } from './measure';
import { DefaultNode, GroupNode, InputNode, OutputNode } from './DefaultNode';

const NO_DRAG_SELECTOR =
  '.rf-handle, .rf-nodrag, input, textarea, select, button, a, [contenteditable="true"]';

/** Renders one node (and its children), subscribed only to its own topic. */
export const NodeView = memo(function NodeView({ id }: { id: string }) {
  const store = useFlowStore();
  const config = useConfig();
  const node = useFlowSelector([`node:${id}`], () => store.nodes.get(id));
  const contentRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
    raf: number | null;
    dx: number;
    dy: number;
  } | null>(null);

  // Measure real size so edges/minimap/culling stay exact. Nodes with an
  // explicit width AND height skip observation entirely (big win when
  // mounting thousands of fixed-size nodes).
  const measurer = useMeasurer();
  const hasFixedSize = node != null && node.width != null && node.height != null;
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !measurer || hasFixedSize) return;
    measurer.observe(el, id);
    return () => measurer.unobserve(el);
  }, [measurer, id, hasFixedSize]);

  const childIds = useChildIds(id);

  if (!node || node.hidden) return null;

  const type = node.type ?? 'default';
  const Comp = config.nodeTypes[type] ?? config.nodeTypes.default ?? DefaultNode;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 || config.readOnly) return;
    if ((e.target as Element).closest(NO_DRAG_SELECTOR)) return;
    e.stopPropagation();
    const current = store.getNode(id);
    if (!current || current.selectable === false) return;

    // Selection on press (drag keeps the selection group together).
    if (!current.selected) {
      if (e.shiftKey || e.metaKey || e.ctrlKey) store.addToSelection([id]);
      else store.setSelection([id]);
    }

    if (current.draggable === false) return;
    const el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events or lost pointers */
    }
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      raf: null,
      dx: 0,
      dy: 0,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const s = dragState.current;
    if (!s || e.pointerId !== s.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.dragging) {
      if (Math.hypot(dx, dy) < 3) return;
      s.dragging = true;
      const sel = store.getNode(id)?.selected
        ? [...store.selectedNodes]
        : [id];
      store.startDrag(sel);
    }
    const zoom = store.viewport.zoom || 1;
    s.dx = dx / zoom;
    s.dy = dy / zoom;
    if (s.raf == null) {
      s.raf = requestAnimationFrame(() => {
        s.raf = null;
        if (dragState.current === s) store.dragBy({ x: s.dx, y: s.dy });
      });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const s = dragState.current;
    if (!s || e.pointerId !== s.pointerId) return;
    dragState.current = null;
    if (s.raf != null) cancelAnimationFrame(s.raf);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (s.dragging) {
      store.dragBy({ x: s.dx, y: s.dy });
      store.endDrag();
    } else if (e.shiftKey || e.metaKey || e.ctrlKey) {
      // Click (no drag) with modifier on an already-selected node: toggle off.
      const current = store.getNode(id);
      if (current?.selected) store.toggleSelection(id);
    }
  };

  const onClick = (e: ReactMouseEvent): void => {
    e.stopPropagation();
    const current = store.getNode(id);
    if (current) config.onNodeClick?.(e, current);
  };

  const onDoubleClick = (e: ReactMouseEvent): void => {
    e.stopPropagation();
    const current = store.getNode(id);
    if (current) config.onNodeDoubleClick?.(e, current);
  };

  const onContextMenu = (e: ReactMouseEvent): void => {
    const current = store.getNode(id);
    if (current && config.onNodeContextMenu) {
      e.stopPropagation();
      config.onNodeContextMenu(e, current);
    }
  };

  const style: CSSProperties = {
    transform: `translate(${node.position.x}px, ${node.position.y}px)`,
    zIndex: node.zIndex ?? (node.selected ? 10 : undefined),
  };
  const contentStyle: CSSProperties = {
    width: node.width,
    height: node.height,
    ...(node.style as CSSProperties),
  };

  const label = node.ariaLabel ?? (node.data as { label?: string })?.label ?? `node ${id}`;

  return (
    <div
      className={`rf-node${node.selected ? ' rf-selected' : ''}${
        node.draggable === false ? '' : ' rf-draggable'
      }${node.className ? ` ${node.className}` : ''}`}
      data-id={id}
      data-type={type}
      style={style}
      // Accessibility: nodes are focusable and announce themselves. Focusing
      // selects; arrow keys move the selection (handled by the pane).
      tabIndex={config.readOnly ? -1 : 0}
      role="button"
      aria-label={label}
      aria-selected={!!node.selected}
      aria-roledescription="node"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onFocus={(e) => {
        // Only react to focus on the node itself, not bubbled from children.
        if (e.target !== e.currentTarget) return;
        const cur = store.getNode(id);
        if (cur && !cur.selected && cur.selectable !== false) store.setSelection([id]);
      }}
    >
      <div
        ref={contentRef}
        className="rf-node-content"
        style={contentStyle}
      >
        <NodeIdContext.Provider value={id}>
          <Comp id={id} data={node.data} node={node} selected={!!node.selected} dragging={false} />
        </NodeIdContext.Provider>
      </div>
      {childIds.map((cid) => (
        <NodeView key={cid} id={cid} />
      ))}
    </div>
  );
});

/** Reactive list of a node's direct children (stable while unchanged). */
const useChildIds = (id: string): string[] => {
  const store = useFlowStore();
  const version = useFlowSelector(['nodes'], () => store.nodesVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => store.childrenOf(id), [store, id, version]);
};

/** Mounts the visible root nodes (viewport culling built in). */
export const NodesLayer = memo(function NodesLayer() {
  const store = useFlowStore();
  const cache = useRef<{ roots: Set<string>; version: number; ids: string[] }>({
    roots: new Set(),
    version: -1,
    ids: [],
  });
  const ids = useFlowSelector(['visible', 'nodes'], () => {
    const c = cache.current;
    if (c.roots !== store.visibleRoots || c.version !== store.nodesVersion) {
      const next: string[] = [];
      for (const id of store.nodeOrder) {
        if (store.visibleRoots.has(id) && !store.nodes.get(id)?.parentId) next.push(id);
      }
      cache.current = { roots: store.visibleRoots, version: store.nodesVersion, ids: next };
    }
    return cache.current.ids;
  });

  return (
    <div className="rf-nodes">
      {ids.map((id) => (
        <NodeView key={id} id={id} />
      ))}
    </div>
  );
});

export const builtinNodeTypes = {
  default: DefaultNode,
  input: InputNode,
  output: OutputNode,
  group: GroupNode,
};
