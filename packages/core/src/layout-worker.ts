import type { XY } from './types';
import {
  layeredLayout,
  treeLayout,
  forceLayout,
  gridLayout,
  radialLayout,
  type LayoutEdge,
  type LayoutNode,
  type LayoutOptions,
  type LayoutType,
} from './layout';

/**
 * A self-contained layout job — everything a Web Worker needs to compute a
 * layout off the main thread. Structured-clone friendly (plain data only).
 */
export interface LayoutJob {
  type: LayoutType;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  options?: LayoutOptions;
  /** Correlates a response to its request. */
  requestId?: number;
}

export interface LayoutResult {
  requestId?: number;
  positions: { id: string; x: number; y: number }[];
}

/**
 * Run a layout job. This is the exact function a worker executes — pure, no
 * DOM, no store — so it can run on any thread. `packages/core/test/
 * layout-worker.test.ts` runs it inside a real worker_threads Worker.
 */
export const runLayoutJob = (job: LayoutJob): LayoutResult => {
  let positions: Map<string, XY>;
  switch (job.type) {
    case 'tree':
      positions = treeLayout(job.nodes, job.edges, job.options);
      break;
    case 'force':
      positions = forceLayout(job.nodes, job.edges, job.options);
      break;
    case 'grid':
      positions = gridLayout(job.nodes, job.options);
      break;
    case 'radial':
      positions = radialLayout(job.nodes, job.edges, job.options);
      break;
    case 'layered':
    default:
      positions = layeredLayout(job.nodes, job.edges, job.options);
      break;
  }
  return {
    requestId: job.requestId,
    positions: [...positions].map(([id, p]) => ({ id, x: p.x, y: p.y })),
  };
};

/**
 * A minimal worker-message handler. Drop this into your worker entry:
 *
 *   import { layoutWorkerHandler } from '@realflow/core';
 *   self.onmessage = (e) => self.postMessage(layoutWorkerHandler(e.data));
 */
export const layoutWorkerHandler = (job: LayoutJob): LayoutResult => runLayoutJob(job);

/** Minimal duck-typed Worker surface (Web Worker or worker_threads). */
export interface WorkerLike {
  postMessage: (msg: unknown) => void;
  addEventListener?: (type: 'message', cb: (ev: { data: unknown }) => void) => void;
  removeEventListener?: (type: 'message', cb: (ev: { data: unknown }) => void) => void;
  on?: (type: 'message', cb: (data: unknown) => void) => void;
  off?: (type: 'message', cb: (data: unknown) => void) => void;
}

let requestCounter = 0;

/**
 * Send a layout job to a worker and await its result — transport-agnostic
 * (accepts a Web Worker or a Node worker_threads Worker). The caller owns the
 * worker's lifecycle.
 */
export const layoutInWorker = (worker: WorkerLike, job: Omit<LayoutJob, 'requestId'>): Promise<LayoutResult> => {
  const requestId = ++requestCounter;
  return new Promise((resolve) => {
    const onMessage = (data: unknown): void => {
      const res = data as LayoutResult;
      if (res && res.requestId === requestId) {
        cleanup();
        resolve(res);
      }
    };
    const webHandler = (ev: { data: unknown }): void => onMessage(ev.data);
    const cleanup = (): void => {
      worker.removeEventListener?.('message', webHandler);
      worker.off?.('message', onMessage);
    };
    worker.addEventListener?.('message', webHandler);
    worker.on?.('message', onMessage);
    worker.postMessage({ ...job, requestId });
  });
};
