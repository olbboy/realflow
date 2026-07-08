import { memo, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { EdgeMarker, Side } from '@realflow/core';
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
  const { d, label } =
    !Custom && type === 'orthogonal'
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
      <path className="rf-edge-hit" d={d} onPointerDown={select} onClick={onClick} />
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
