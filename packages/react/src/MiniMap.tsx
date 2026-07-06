import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Rect } from '@reflow/core';
import { rectUnion, visibleRect } from '@reflow/core';
import { useFlowStore } from './context';
import { Panel, type PanelPosition } from './Panel';

export interface MiniMapProps {
  position?: PanelPosition;
  width?: number;
  height?: number;
  /** Click/drag the minimap to navigate. Default true. */
  interactive?: boolean;
}

/** Overview map with viewport indicator and drag-to-navigate. */
export const MiniMap = memo(function MiniMap({
  position = 'bottom-right',
  width = 200,
  height = 140,
  interactive = true,
}: MiniMapProps) {
  const store = useFlowStore();
  const [, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Coalesce graph + viewport changes into one repaint per frame.
  useEffect(() => {
    const bump = (): void => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setTick((t) => t + 1);
      });
    };
    const unsubs = [store.subscribe('graph', bump), store.subscribe('viewport', bump)];
    return () => {
      unsubs.forEach((u) => u());
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [store]);

  const view = visibleRect(store.viewport, store.screen.width || 1, store.screen.height || 1);
  let bounds: Rect | null = null;
  const rects: { id: string; rect: Rect; selected: boolean }[] = [];
  for (const id of store.nodeOrder) {
    const node = store.nodes.get(id)!;
    if (node.hidden || node.parentId) continue;
    const rect = store.nodeRect(id);
    rects.push({ id, rect, selected: !!node.selected });
    bounds = rectUnion(bounds, rect);
  }
  const world = rectUnion(bounds, view);
  const pad = 20;
  const wx = world.x - pad;
  const wy = world.y - pad;
  const ww = world.width + pad * 2;
  const wh = world.height + pad * 2;
  const scale = Math.min(width / ww, height / wh);
  const ox = (width - ww * scale) / 2;
  const oy = (height - wh * scale) / 2;
  const tx = (v: number): number => (v - wx) * scale + ox;
  const ty = (v: number): number => (v - wy) * scale + oy;

  const navigate = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>): void => {
      const svg = e.currentTarget.getBoundingClientRect();
      const fx = (e.clientX - svg.left - ox) / scale + wx;
      const fy = (e.clientY - svg.top - oy) / scale + wy;
      const { zoom } = store.viewport;
      store.setViewport({
        x: store.screen.width / 2 - fx * zoom,
        y: store.screen.height / 2 - fy * zoom,
        zoom,
      });
    },
    [store, ox, oy, scale, wx, wy]
  );

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>): void => {
    if (!interactive || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    navigate(e);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
    if (!interactive || e.buttons !== 1) return;
    navigate(e);
  };

  return (
    <Panel position={position} className="rf-minimap-panel">
      <svg
        className="rf-minimap"
        width={width}
        height={height}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        role="img"
        aria-label="Mini map"
      >
        {rects.map(({ id, rect, selected }) => (
          <rect
            key={id}
            className={`rf-minimap-node${selected ? ' rf-selected' : ''}`}
            x={tx(rect.x)}
            y={ty(rect.y)}
            width={Math.max(rect.width * scale, 2)}
            height={Math.max(rect.height * scale, 1.5)}
            rx={1.5}
          />
        ))}
        <rect
          className="rf-minimap-viewport"
          x={tx(view.x)}
          y={ty(view.y)}
          width={view.width * scale}
          height={view.height * scale}
          rx={2}
        />
      </svg>
    </Panel>
  );
});
