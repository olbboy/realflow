import { memo, useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { HandleKind, Side } from '@reflow/core';
import { screenToFlow } from '@reflow/core';
import { useFlowStore, useNodeId } from './context';
import { useConfig, useContainer } from './config';
import { useMeasurer } from './measure';

export interface HandleProps {
  /** 'source' emits connections, 'target' accepts them. */
  kind: HandleKind;
  /** Which side of the node the handle sits on. Default: source→right, target→left. */
  side?: Side;
  /** Distinguishes multiple handles on one node. */
  id?: string;
  /** Typed port: only matching dataTypes can connect. */
  dataType?: string;
  /** Cap simultaneous connections through this handle. */
  maxConnections?: number;
  /** Disable interaction for this handle. */
  connectable?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
}

/**
 * A connection point. Drop it anywhere inside a custom node — position is
 * measured automatically, so edges always anchor exactly on the handle.
 */
export const Handle = memo(function Handle({
  kind,
  side,
  id,
  dataType,
  maxConnections,
  connectable = true,
  className,
  style,
  children,
}: HandleProps) {
  const store = useFlowStore();
  const nodeId = useNodeId();
  const config = useConfig();
  const container = useContainer();
  const ref = useRef<HTMLDivElement>(null);
  const resolvedSide: Side = side ?? (kind === 'source' ? 'right' : 'left');
  const handleId = id ?? `__${kind}`;

  // Measure the handle's center relative to the node origin and register it.
  // Measurements are queued and flushed in one batched read/write pass.
  const measurer = useMeasurer();
  useEffect(() => {
    const el = ref.current;
    if (!el || !measurer) return;
    const spec = {
      id: handleId,
      nodeId,
      kind,
      side: resolvedSide,
      dataType,
      maxConnections,
    };
    measurer.queueHandle(el, spec);
    // Re-measure when this node resizes (its topic fires on size changes).
    const unsub = store.subscribe(`node:${nodeId}`, () => measurer.queueHandle(el, spec));
    return () => {
      unsub();
      // Keep registrations for culled unmounts so offscreen edges stay
      // anchored; only drop the handle if its node is still mounted.
      if (store.nodes.has(nodeId) && store.visibleNodes.has(nodeId)) {
        store.unregisterHandle(nodeId, handleId);
      }
    };
  }, [store, measurer, nodeId, handleId, kind, resolvedSide, dataType, maxConnections]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 || config.readOnly || !connectable) return;
    const node = store.getNode(nodeId);
    if (!node || node.connectable === false) return;
    e.stopPropagation();
    e.preventDefault();
    const el = ref.current!;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events or lost pointers */
    }
    store.startConnection(nodeId, handleId, kind);

    const toFlow = (clientX: number, clientY: number) => {
      const rect = container.current?.getBoundingClientRect();
      return screenToFlow(
        { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) },
        store.viewport
      );
    };

    const onMove = (ev: PointerEvent): void => {
      store.moveConnection(toFlow(ev.clientX, ev.clientY));
    };
    const onUp = (): void => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      const edge = store.endConnection();
      if (edge) config.onConnect?.(edge);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };

  return (
    <div
      ref={ref}
      data-handleid={handleId}
      data-kind={kind}
      className={`rf-handle rf-handle-${kind} rf-handle-${resolvedSide}${
        className ? ` ${className}` : ''
      }`}
      style={style}
      onPointerDown={onPointerDown}
      role="button"
      aria-label={`${kind} handle`}
    >
      {children}
    </div>
  );
});
