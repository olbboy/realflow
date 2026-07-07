import type { Rect } from './types';
import { rectsIntersect } from './geometry';

/**
 * A uniform-grid spatial hash for fast viewport culling and hit testing.
 *
 * Nodes are bucketed by the grid cells their bounds overlap. Queries visit
 * only the cells intersecting the query rect, so lookups stay O(result)
 * instead of O(total nodes) — the key to keeping 10k+ node flows smooth.
 */
export class SpatialIndex {
  private cellSize: number;
  private cells = new Map<string, Set<string>>();
  private bounds = new Map<string, Rect>();
  /**
   * Rects too large (or non-finite) to bucket sanely. Iterating the grid
   * cells of, say, a 1e308-wide rect would loop ~1e305 times and hang — a
   * real DoS vector when an agent/LLM emits a degenerate node size. Such
   * rects are kept here and always considered by queries/hits instead.
   */
  private oversized = new Set<string>();

  /** Max grid cells a single rect may span before it's treated as oversized. */
  private static readonly MAX_CELLS = 4096;

  constructor(cellSize = 512) {
    this.cellSize = cellSize;
  }

  get size(): number {
    return this.bounds.size;
  }

  /**
   * Largest cell index magnitude we bucket. Beyond ~2^40, floating-point
   * `index++` stops advancing (1 is lost past 2^53), so a `for` loop over
   * cell keys would never terminate. Cap well below that.
   */
  private static readonly MAX_CELL_INDEX = 2 ** 40;

  /** True when a rect can't be bucketed sanely (too big, too far out, or non-finite). */
  private isOversized(r: Rect): boolean {
    if (
      !Number.isFinite(r.x) ||
      !Number.isFinite(r.y) ||
      !Number.isFinite(r.width) ||
      !Number.isFinite(r.height)
    ) {
      return true;
    }
    const s = this.cellSize;
    const x0 = Math.floor(r.x / s);
    const y0 = Math.floor(r.y / s);
    const x1 = Math.floor((r.x + Math.max(0, r.width)) / s);
    const y1 = Math.floor((r.y + Math.max(0, r.height)) / s);
    // Coordinates so large the cell-index loop counter can't increment.
    const lim = SpatialIndex.MAX_CELL_INDEX;
    if (
      Math.abs(x0) > lim ||
      Math.abs(y0) > lim ||
      Math.abs(x1) > lim ||
      Math.abs(y1) > lim
    ) {
      return true;
    }
    return (x1 - x0 + 1) * (y1 - y0 + 1) > SpatialIndex.MAX_CELLS;
  }

  private *cellKeys(r: Rect): Generator<string> {
    const s = this.cellSize;
    const x0 = Math.floor(r.x / s);
    const y0 = Math.floor(r.y / s);
    const x1 = Math.floor((r.x + r.width) / s);
    const y1 = Math.floor((r.y + r.height) / s);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        yield `${cx}:${cy}`;
      }
    }
  }

  set(id: string, rect: Rect): void {
    const prev = this.bounds.get(id);
    if (
      prev &&
      prev.x === rect.x &&
      prev.y === rect.y &&
      prev.width === rect.width &&
      prev.height === rect.height
    ) {
      return;
    }
    if (prev) this.removeFromCells(id, prev);
    this.bounds.set(id, { ...rect });
    if (this.isOversized(rect)) {
      this.oversized.add(id);
      return;
    }
    this.oversized.delete(id);
    for (const key of this.cellKeys(rect)) {
      let cell = this.cells.get(key);
      if (!cell) {
        cell = new Set();
        this.cells.set(key, cell);
      }
      cell.add(id);
    }
  }

  delete(id: string): void {
    const prev = this.bounds.get(id);
    if (!prev) return;
    this.removeFromCells(id, prev);
    this.oversized.delete(id);
    this.bounds.delete(id);
  }

  private removeFromCells(id: string, rect: Rect): void {
    // Oversized rects were never bucketed, so there are no cells to clean.
    if (this.oversized.has(id) || this.isOversized(rect)) return;
    for (const key of this.cellKeys(rect)) {
      const cell = this.cells.get(key);
      if (cell) {
        cell.delete(id);
        if (cell.size === 0) this.cells.delete(key);
      }
    }
  }

  getBounds(id: string): Rect | undefined {
    return this.bounds.get(id);
  }

  /** Ids whose bounds intersect the query rect. */
  query(rect: Rect): Set<string> {
    const out = new Set<string>();
    if (!this.isOversized(rect)) {
      for (const key of this.cellKeys(rect)) {
        const cell = this.cells.get(key);
        if (!cell) continue;
        for (const id of cell) {
          if (out.has(id)) continue;
          const b = this.bounds.get(id)!;
          if (rectsIntersect(b, rect)) out.add(id);
        }
      }
    } else {
      // Degenerate query rect: fall back to a linear scan (rare).
      for (const [id, b] of this.bounds) if (rectsIntersect(b, rect)) out.add(id);
      return out;
    }
    // Oversized nodes live outside the grid; test each against the query.
    for (const id of this.oversized) {
      if (rectsIntersect(this.bounds.get(id)!, rect)) out.add(id);
    }
    return out;
  }

  /** Ids whose bounds contain the point. */
  hit(x: number, y: number): string[] {
    const out: string[] = [];
    const key = `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`;
    const cell = this.cells.get(key);
    if (cell) {
      for (const id of cell) {
        const b = this.bounds.get(id)!;
        if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) out.push(id);
      }
    }
    for (const id of this.oversized) {
      const b = this.bounds.get(id)!;
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) out.push(id);
    }
    return out;
  }

  clear(): void {
    this.cells.clear();
    this.bounds.clear();
    this.oversized.clear();
  }
}
