import { memo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useFlowStore, useNodeId } from './context';
import { useFlowSelector, useViewport } from './hooks';

export interface NodeResizerProps {
  nodeId?: string;
  /** Only render while the node is selected. Default true. */
  isVisible?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Preserve aspect ratio while resizing. */
  keepAspectRatio?: boolean;
  color?: string;
  /** Fired continuously during resize. */
  onResize?: (size: { width: number; height: number }) => void;
  /** Fired once when resizing ends (a single undo entry is recorded). */
  onResizeEnd?: (size: { width: number; height: number }) => void;
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSOR: Record<HandleId, string> = {
  nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
  se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
};

/**
 * Drag-to-resize handles around a node (8 grips). Updates the node's
 * width/height (and position for top/left grips) live, and records a single
 * undo entry per resize gesture. Counter-scaled so grips stay grabbable.
 */
export const NodeResizer = memo(function NodeResizer({
  nodeId,
  isVisible,
  minWidth = 40,
  minHeight = 30,
  maxWidth = Infinity,
  maxHeight = Infinity,
  keepAspectRatio = false,
  color,
  onResize,
  onResizeEnd,
}: NodeResizerProps) {
  const store = useFlowStore();
  const ctxId = useNodeId();
  const id = nodeId ?? ctxId;
  const { zoom } = useViewport();
  const node = useFlowSelector([`node:${id}`], () => store.nodes.get(id));
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startPX: number;
    startPY: number;
    handle: HandleId;
    ratio: number;
  } | null>(null);

  if (!node || node.hidden) return null;
  const show = isVisible ?? !!node.selected;
  if (!show) return null;

  const size = store.nodeSize(id);
  const inv = 1 / zoom;

  const onPointerDown = (h: HandleId) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const cur = store.getNode(id)!;
    const s = store.nodeSize(id);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: s.width,
      startH: s.height,
      startPX: cur.position.x,
      startPY: cur.position.y,
      handle: h,
      ratio: s.width / s.height,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    e.stopPropagation();
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    const h = d.handle;
    let w = d.startW;
    let ht = d.startH;
    let px = d.startPX;
    let py = d.startPY;
    const east = h.includes('e');
    const west = h.includes('w');
    const south = h.includes('s');
    const north = h.includes('n');

    if (east) w = d.startW + dx;
    if (west) w = d.startW - dx;
    if (south) ht = d.startH + dy;
    if (north) ht = d.startH - dy;

    w = Math.max(minWidth, Math.min(maxWidth, w));
    ht = Math.max(minHeight, Math.min(maxHeight, ht));

    if (keepAspectRatio) {
      if (east || west) ht = w / d.ratio;
      else w = ht * d.ratio;
    }

    // West/north grips move the origin so the opposite edge stays put.
    if (west) px = d.startPX + (d.startW - w);
    if (north) py = d.startPY + (d.startH - ht);

    store.updateNode(id, { width: w, height: ht, position: { x: px, y: py } });
    onResize?.({ width: w, height: ht });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    const s = store.nodeSize(id);
    onResizeEnd?.({ width: s.width, height: s.height });
  };

  const style = color ? ({ ['--rf-resizer' as string]: color }) : undefined;

  return (
    <>
      <div className="rf-resizer-outline" style={style} />
      {HANDLES.map((h) => {
        const pos: Record<string, string | number> = { position: 'absolute' };
        if (h.includes('n')) pos.top = 0;
        if (h.includes('s')) pos.top = size.height;
        if (h.includes('w')) pos.left = 0;
        if (h.includes('e')) pos.left = size.width;
        if (h === 'n' || h === 's') pos.left = size.width / 2;
        if (h === 'e' || h === 'w') pos.top = size.height / 2;
        return (
          <div
            key={h}
            className={`rf-resizer-handle rf-resizer-${h}`}
            style={{
              ...pos,
              transform: `translate(-50%, -50%) scale(${inv})`,
              cursor: CURSOR[h],
              ...style,
            }}
            onPointerDown={onPointerDown(h)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            role="slider"
            aria-label={`resize ${h}`}
          />
        );
      })}
    </>
  );
});
