import { memo, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { EdgeMarker, Side, XY } from '@realflow/core';
import { edgePath, roundedPath, routeOrthogonal, screenToFlow } from '@realflow/core';
import { useFlowStore } from './context';
import { useConfig, useContainer } from './config';
import { useConnection, useFlowSelector } from './hooks';

const markerUrl = (m?: EdgeMarker): string | undefined =>
  m ? `url(#rf-m-${m.type})` : undefined;

/** One edge, subscribed to its own topic (fires when its endpoints move). */
export const EdgeView = memo(function EdgeView({ id }: { id: string }) {
  const store = useFlowStore();
  const config = useConfig();
  const container = useContainer();
  // Orthogonal edges depend on OTHER nodes (obstacles), so they must also
  // re-render on any graph change; normal edges only track their endpoints.
  const isOrtho = store.edges.get(id)?.type === 'orthogonal';
  // Subscribe to the edge's render version: it bumps when the edge object
  // changes AND when its endpoints move/resize (geometry dependencies).
  useFlowSelector(isOrtho ? [`edge:${id}`, 'graph'] : [`edge:${id}`], () =>
    isOrtho ? store.edgeVersion(id) + store.graphVersion : store.edgeVersion(id)
  );
  const edge = store.edges.get(id);
  if (!edge || edge.hidden) return null;
  const geo = store.edgeGeometry(edge);
  if (!geo) return null;

  const type = edge.type ?? 'bezier';
  const Custom = config.edgeTypes[type];
  const hasControlPoints = (edge.controlPoints?.length ?? 0) > 0;
  const { d, label } =
    !Custom && type === 'orthogonal' && !hasControlPoints
      ? roundedPath(
          routeOrthogonal({
            source: geo.source,
            sourceSide: geo.sourceSide,
            target: geo.target,
            targetSide: geo.targetSide,
            obstacles: store.edgeObstacles(edge),
          }),
          8
        )
      : edgePath(Custom ? 'bezier' : type, {
          source: geo.source,
          sourceSide: geo.sourceSide,
          target: geo.target,
          targetSide: geo.targetSide,
          waypoints: edge.controlPoints,
        });

  const select = (e: ReactPointerEvent): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (config.readOnly || edge.selectable === false) return;
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      store.toggleSelection(undefined, id);
    } else {
      store.setSelection([], [id]);
    }
  };

  const onClick = (e: ReactMouseEvent): void => {
    e.stopPropagation();
    config.onEdgeClick?.(e, edge);
  };

  // Double-click the edge to add an editable control point at the pointer,
  // inserted into the segment it is nearest so multi-point order stays natural.
  const addControlPoint = (e: ReactMouseEvent): void => {
    if (config.readOnly || edge.selectable === false || edge.deletable === false) return;
    e.stopPropagation();
    const r = container.current?.getBoundingClientRect();
    const p = screenToFlow({ x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) }, store.viewport);
    const cps = edge.controlPoints ?? [];
    const chain = [geo.source, ...cps, geo.target];
    let at = cps.length;
    let best = Infinity;
    for (let i = 0; i < chain.length - 1; i++) {
      const dseg = distToSegment(p, chain[i], chain[i + 1]);
      if (dseg < best) {
        best = dseg;
        at = i;
      }
    }
    const next = [...cps];
    next.splice(at, 0, p);
    store.updateEdge(id, { controlPoints: next });
    store.setSelection([], [id]);
  };

  if (Custom) {
    return (
      <g className="rf-edge rf-edge-custom" data-id={id} onPointerDown={select} onClick={onClick}>
        <Custom
          id={id}
          edge={edge}
          path={d}
          labelX={label.x}
          labelY={label.y}
          sourceX={geo.source.x}
          sourceY={geo.source.y}
          targetX={geo.target.x}
          targetY={geo.target.y}
          sourceSide={geo.sourceSide}
          targetSide={geo.targetSide}
          selected={!!edge.selected}
        />
      </g>
    );
  }

  return (
    <g
      className={`rf-edge${edge.selected ? ' rf-selected' : ''}${
        edge.animated ? ' rf-animated' : ''
      }${edge.className ? ` ${edge.className}` : ''}`}
      data-id={id}
    >
      <path className="rf-edge-hit" d={d} onPointerDown={select} onClick={onClick} onDoubleClick={addControlPoint} />
      <path
        className="rf-edge-path"
        d={d}
        style={edge.style as React.CSSProperties}
        markerStart={markerUrl(edge.markerStart)}
        markerEnd={markerUrl(edge.markerEnd)}
      />
      {edge.label ? (
        <g className="rf-edge-label" transform={`translate(${label.x}, ${label.y})`}>
          <rect className="rf-edge-label-bg" rx="4" />
          <text dominantBaseline="middle" textAnchor="middle">
            {edge.label}
          </text>
        </g>
      ) : null}
      {edge.selected && !config.readOnly && edge.deletable !== false ? (
        <>
          <ReconnectHandle edgeId={id} end="source" x={geo.source.x} y={geo.source.y} />
          <ReconnectHandle edgeId={id} end="target" x={geo.target.x} y={geo.target.y} />
          {(edge.controlPoints ?? []).map((cp, i) => (
            <ControlPointHandle key={i} edgeId={id} index={i} x={cp.x} y={cp.y} />
          ))}
        </>
      ) : null}
    </g>
  );
});

/** Draggable endpoint shown on a selected edge; drag it to reconnect. */
const ReconnectHandle = memo(function ReconnectHandle({
  edgeId,
  end,
  x,
  y,
}: {
  edgeId: string;
  end: 'source' | 'target';
  x: number;
  y: number;
}) {
  const store = useFlowStore();
  const config = useConfig();
  const container = useContainer();
  const onPointerDown = (e: ReactPointerEvent<SVGCircleElement>): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    store.startReconnect(edgeId, end);
    const toFlow = (cx: number, cy: number) => {
      const r = container.current?.getBoundingClientRect();
      return screenToFlow({ x: cx - (r?.left ?? 0), y: cy - (r?.top ?? 0) }, store.viewport);
    };
    const move = (ev: PointerEvent) => store.moveConnection(toFlow(ev.clientX, ev.clientY));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      const edge = store.endConnection();
      if (edge) config.onConnect?.(edge);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  return (
    <circle
      className="rf-edge-reconnect"
      cx={x}
      cy={y}
      r={5}
      onPointerDown={onPointerDown}
      role="button"
      aria-label={`reconnect ${end}`}
    />
  );
});

/** Perpendicular distance from point `p` to segment `a`–`b`. */
const distToSegment = (p: XY, a: XY, b: XY): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/** Draggable control point on a selected editable edge; double-click removes it. */
const ControlPointHandle = memo(function ControlPointHandle({
  edgeId,
  index,
  x,
  y,
}: {
  edgeId: string;
  index: number;
  x: number;
  y: number;
}) {
  const store = useFlowStore();
  const container = useContainer();
  const onPointerDown = (e: ReactPointerEvent<SVGCircleElement>): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const before = [...(store.edges.get(edgeId)?.controlPoints ?? [])];
    const toFlow = (cx: number, cy: number): XY => {
      const r = container.current?.getBoundingClientRect();
      return screenToFlow({ x: cx - (r?.left ?? 0), y: cy - (r?.top ?? 0) }, store.viewport);
    };
    const move = (ev: PointerEvent): void => {
      const cur = store.edges.get(edgeId)?.controlPoints ?? before;
      const pts = [...cur];
      pts[index] = toFlow(ev.clientX, ev.clientY);
      store.setEdgeControlPointsLive(edgeId, pts);
    };
    const up = (): void => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      const final = store.edges.get(edgeId)?.controlPoints ?? before;
      // Restore the pre-drag value, then record once so undo captures net move.
      store.setEdgeControlPointsLive(edgeId, before);
      store.updateEdge(edgeId, { controlPoints: final });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const onDoubleClick = (e: ReactMouseEvent): void => {
    e.stopPropagation();
    const cur = store.edges.get(edgeId)?.controlPoints ?? [];
    store.updateEdge(edgeId, { controlPoints: cur.filter((_, i) => i !== index) });
  };
  return (
    <circle
      className="rf-edge-control"
      cx={x}
      cy={y}
      r={5}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      role="button"
      aria-label="edge control point"
    />
  );
});

/** The in-progress connection line. */
const ConnectionLine = memo(function ConnectionLine() {
  const store = useFlowStore();
  const conn = useConnection();
  if (!conn) return null;
  const from = store.handleAnchor(conn.fromHandle);
  const opposite: Record<Side, Side> = {
    left: 'right',
    right: 'left',
    top: 'bottom',
    bottom: 'top',
  };
  const { d } = edgePath('bezier', {
    source: from,
    sourceSide: conn.fromHandle.side,
    target: conn.to,
    targetSide: conn.toHandle?.side ?? opposite[conn.fromHandle.side],
  });
  const cls =
    conn.valid === true ? ' rf-valid' : conn.valid === false ? ' rf-invalid' : '';
  return <path className={`rf-connection-line${cls}`} d={d} />;
});

/** Figma-style alignment guide lines. */
const GuidesLayer = memo(function GuidesLayer() {
  const store = useFlowStore();
  const guides = useFlowSelector(['guides'], () => store.guides);
  if (guides.length === 0) return null;
  return (
    <g className="rf-guides">
      {guides.map((g, i) =>
        g.axis === 'x' ? (
          <line key={i} x1={g.value} y1={g.from} x2={g.value} y2={g.to} className="rf-guide" />
        ) : (
          <line key={i} x1={g.from} y1={g.value} x2={g.to} y2={g.value} className="rf-guide" />
        )
      )}
    </g>
  );
});

const MarkerDefs = memo(function MarkerDefs() {
  return (
    <defs>
      <marker
        id="rf-m-arrow"
        viewBox="-10 -10 20 20"
        markerWidth="14"
        markerHeight="14"
        refX="0"
        refY="0"
        orient="auto-start-reverse"
      >
        <polyline
          points="-6,-5 0,0 -6,5"
          fill="none"
          stroke="context-stroke"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>
      <marker
        id="rf-m-arrowclosed"
        viewBox="-10 -10 20 20"
        markerWidth="12"
        markerHeight="12"
        refX="0"
        refY="0"
        orient="auto-start-reverse"
      >
        <polygon points="-7,-5 0,0 -7,5" fill="context-stroke" stroke="none" />
      </marker>
      <marker
        id="rf-m-dot"
        viewBox="-5 -5 10 10"
        markerWidth="10"
        markerHeight="10"
        refX="0"
        refY="0"
      >
        <circle r="3" fill="context-stroke" />
      </marker>
    </defs>
  );
});

/** SVG layer with all visible edges, the connection line and guides. */
export const EdgesLayer = memo(function EdgesLayer() {
  const store = useFlowStore();
  const cache = useRef<{ visible: Set<string>; version: number; ids: string[] }>({
    visible: new Set(),
    version: -1,
    ids: [],
  });
  const ids = useFlowSelector(['visible', 'edges'], () => {
    const c = cache.current;
    if (c.visible !== store.visibleEdges || c.version !== store.edgesVersion) {
      const next: string[] = [];
      for (const id of store.edgeOrder) {
        if (store.visibleEdges.has(id)) next.push(id);
      }
      cache.current = { visible: store.visibleEdges, version: store.edgesVersion, ids: next };
    }
    return cache.current.ids;
  });

  return (
    <svg className="rf-edges" aria-hidden="true">
      <MarkerDefs />
      {ids.map((id) => (
        <EdgeView key={id} id={id} />
      ))}
      <GuidesLayer />
      <ConnectionLine />
    </svg>
  );
});
