import { memo, useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Rect } from '@reflow/core';
import { rectUnion, visibleRect } from '@reflow/core';
import { useFlowStore } from './context';
import { Panel, type PanelPosition } from './Panel';

export interface MiniMapProps {
  position?: PanelPosition;
  className?: string;
  width?: number;
  height?: number;
  /** Click/drag the minimap to navigate. Default true. */
  interactive?: boolean;
}

interface MapTransform {
  scale: number;
  wx: number;
  wy: number;
  ox: number;
  oy: number;
}

/**
 * Overview map with drag-to-navigate. Renders on a canvas, so even
 * 10,000-node flows repaint in ~a millisecond — no per-node React elements.
 */
export const MiniMap = memo(function MiniMap({
  position = 'bottom-right',
  width = 200,
  height = 140,
  interactive = true,
  className,
}: MiniMapProps) {
  const store = useFlowStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transform = useRef<MapTransform>({ scale: 1, wx: 0, wy: 0, ox: 0, oy: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    let raf: number | null = null;
    const draw = (): void => {
      raf = null;
      const styles = getComputedStyle(canvas);
      const nodeColor = styles.getPropertyValue('--rf-minimap-node').trim() || 'rgba(0,0,0,0.14)';
      const accent = styles.getPropertyValue('--rf-accent').trim() || '#6366f1';
      const mask = styles.getPropertyValue('--rf-minimap-mask').trim() || 'rgba(99,102,241,0.08)';

      const view = visibleRect(store.viewport, store.screen.width || 1, store.screen.height || 1);
      let bounds: Rect | null = null;
      const rects: { rect: Rect; selected: boolean }[] = [];
      for (const id of store.nodeOrder) {
        const node = store.nodes.get(id)!;
        if (node.hidden) continue;
        const rect = store.nodeRect(id);
        rects.push({ rect, selected: !!node.selected });
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
      transform.current = { scale, wx, wy, ox, oy };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = nodeColor;
      let selectedRects: Rect[] | null = null;
      for (const { rect, selected } of rects) {
        if (selected) {
          (selectedRects ??= []).push(rect);
          continue;
        }
        ctx.fillRect(
          (rect.x - wx) * scale + ox,
          (rect.y - wy) * scale + oy,
          Math.max(rect.width * scale, 1.5),
          Math.max(rect.height * scale, 1.2)
        );
      }
      if (selectedRects) {
        ctx.fillStyle = accent;
        for (const rect of selectedRects) {
          ctx.fillRect(
            (rect.x - wx) * scale + ox,
            (rect.y - wy) * scale + oy,
            Math.max(rect.width * scale, 1.5),
            Math.max(rect.height * scale, 1.2)
          );
        }
      }

      // Viewport indicator.
      ctx.fillStyle = mask;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.2;
      const vx = (view.x - wx) * scale + ox;
      const vy = (view.y - wy) * scale + oy;
      ctx.fillRect(vx, vy, view.width * scale, view.height * scale);
      ctx.strokeRect(vx, vy, view.width * scale, view.height * scale);
    };

    const schedule = (): void => {
      if (raf == null) raf = requestAnimationFrame(draw);
    };
    draw();
    const unsubs = [
      store.subscribe('graph', schedule),
      store.subscribe('viewport', schedule),
      store.subscribe('selection', schedule),
    ];
    return () => {
      unsubs.forEach((u) => u());
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [store, width, height]);

  const navigate = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): void => {
      const { scale, wx, wy, ox, oy } = transform.current;
      const box = e.currentTarget.getBoundingClientRect();
      const fx = (e.clientX - box.left - ox) / scale + wx;
      const fy = (e.clientY - box.top - oy) / scale + wy;
      const { zoom } = store.viewport;
      store.setViewport({
        x: store.screen.width / 2 - fx * zoom,
        y: store.screen.height / 2 - fy * zoom,
        zoom,
      });
    },
    [store]
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!interactive || e.button !== 0) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events */
    }
    navigate(e);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!interactive || e.buttons !== 1) return;
    navigate(e);
  };

  return (
    <Panel position={position} className={`rf-minimap-panel${className ? ` ${className}` : ''}`}>
      <canvas
        ref={canvasRef}
        className="rf-minimap"
        style={{ width, height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        role="img"
        aria-label="Mini map"
      />
    </Panel>
  );
});
