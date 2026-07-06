import { createContext, useContext } from 'react';
import type { FlowStore, HandleInfo } from '@reflow/core';

export type HandleSpec = Omit<HandleInfo, 'x' | 'y'>;

export interface Measurer {
  observe: (el: Element, id: string) => void;
  unobserve: (el: Element) => void;
  /** Queue a handle-position measurement; flushed in one batched rAF pass
   *  (all DOM reads together, then all store writes) to avoid layout
   *  thrashing when many nodes mount at once. */
  queueHandle: (el: Element, spec: HandleSpec) => void;
  disconnect: () => void;
}

/**
 * One ResizeObserver per flow (not per node) — entries are batched into a
 * single store update per resize tick, which matters when thousands of
 * nodes mount at once.
 */
export const createMeasurer = (store: FlowStore): Measurer => {
  const handleQueue = new Map<Element, HandleSpec>();
  let handleFlush: number | null = null;

  const flushHandles = (): void => {
    handleFlush = null;
    const zoom = store.viewport.zoom || 1;
    // Phase 1: all DOM reads.
    const measured: { spec: HandleSpec; x: number; y: number }[] = [];
    for (const [el, spec] of handleQueue) {
      if (!el.isConnected) continue;
      const content = el.closest('.rf-node-content');
      if (!content) continue;
      const hr = el.getBoundingClientRect();
      const cr = content.getBoundingClientRect();
      measured.push({
        spec,
        x: (hr.left + hr.width / 2 - cr.left) / zoom,
        y: (hr.top + hr.height / 2 - cr.top) / zoom,
      });
    }
    handleQueue.clear();
    // Phase 2: all store writes.
    store.batch(() => {
      for (const m of measured) store.registerHandle({ ...m.spec, x: m.x, y: m.y });
    });
  };

  const queueHandle = (el: Element, spec: HandleSpec): void => {
    handleQueue.set(el, spec);
    if (handleFlush == null) {
      handleFlush =
        typeof requestAnimationFrame !== 'undefined'
          ? requestAnimationFrame(flushHandles)
          : (setTimeout(flushHandles, 0) as unknown as number);
    }
  };

  if (typeof ResizeObserver === 'undefined') {
    return { observe: () => {}, unobserve: () => {}, queueHandle, disconnect: () => {} };
  }
  const ids = new WeakMap<Element, string>();
  const ro = new ResizeObserver((entries) => {
    store.batch(() => {
      for (const entry of entries) {
        const id = ids.get(entry.target);
        if (!id) continue;
        const box = entry.borderBoxSize?.[0];
        const width = box ? box.inlineSize : entry.contentRect.width;
        const height = box ? box.blockSize : entry.contentRect.height;
        if (width > 0 && height > 0) store.setNodeSize(id, width, height);
      }
    });
  });
  return {
    observe: (el, id) => {
      ids.set(el, id);
      ro.observe(el);
    },
    unobserve: (el) => ro.unobserve(el),
    queueHandle,
    disconnect: () => ro.disconnect(),
  };
};

export const MeasureContext = createContext<Measurer | null>(null);

export const useMeasurer = (): Measurer | null => useContext(MeasureContext);
