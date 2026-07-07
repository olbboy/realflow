import { describe, expect, it } from 'vitest';
import { SpatialIndex } from '@reflow/core';

describe('SpatialIndex', () => {
  it('query returns intersecting ids only', () => {
    const idx = new SpatialIndex(100);
    idx.set('a', { x: 0, y: 0, width: 50, height: 50 });
    idx.set('b', { x: 500, y: 500, width: 50, height: 50 });
    idx.set('c', { x: 40, y: 40, width: 50, height: 50 });
    const hits = idx.query({ x: 0, y: 0, width: 60, height: 60 });
    expect(hits.has('a')).toBe(true);
    expect(hits.has('c')).toBe(true);
    expect(hits.has('b')).toBe(false);
  });

  it('updates on move', () => {
    const idx = new SpatialIndex(100);
    idx.set('a', { x: 0, y: 0, width: 10, height: 10 });
    idx.set('a', { x: 1000, y: 1000, width: 10, height: 10 });
    expect(idx.query({ x: 0, y: 0, width: 100, height: 100 }).size).toBe(0);
    expect(idx.query({ x: 990, y: 990, width: 100, height: 100 }).has('a')).toBe(true);
  });

  it('delete removes from all cells', () => {
    const idx = new SpatialIndex(10);
    idx.set('big', { x: 0, y: 0, width: 100, height: 100 });
    idx.delete('big');
    expect(idx.query({ x: 0, y: 0, width: 200, height: 200 }).size).toBe(0);
    expect(idx.size).toBe(0);
  });

  it('hit test', () => {
    const idx = new SpatialIndex(100);
    idx.set('a', { x: 10, y: 10, width: 20, height: 20 });
    expect(idx.hit(15, 15)).toEqual(['a']);
    expect(idx.hit(500, 500)).toEqual([]);
  });

  it('handles degenerate / oversized rects without hanging (DoS guard)', () => {
    const idx = new SpatialIndex(512);
    const t0 = performance.now();
    // A huge finite rect would otherwise make cellKeys iterate ~1e305 cells.
    idx.set('huge', { x: 0, y: 0, width: 1e308, height: 1e308 });
    idx.set('nan', { x: NaN, y: 0, width: 100, height: 100 });
    idx.set('inf', { x: 0, y: 0, width: Infinity, height: 10 });
    // A normal-sized rect at an extreme coordinate: the cell index exceeds
    // 2^53 so `index++` can't advance — the subtler hang.
    idx.set('far', { x: 0, y: -5e307, width: 40, height: 40 });
    idx.set('normal', { x: 50, y: 50, width: 40, height: 40 });
    // Moving/removing the huge rect must also be instant.
    idx.set('huge', { x: 100, y: 100, width: 1e308, height: 1e308 });
    idx.delete('inf');
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(100);
    // The oversized rect is still found by an intersecting query.
    const hit = idx.query({ x: 200, y: 200, width: 50, height: 50 });
    expect(hit.has('huge')).toBe(true);
    expect(hit.has('normal')).toBe(false);
    // Normal rects still work.
    expect(idx.query({ x: 40, y: 40, width: 20, height: 20 }).has('normal')).toBe(true);
    expect(idx.hit(120, 120)).toContain('huge');
  });

  it('scales to 10k rects with fast queries', () => {
    const idx = new SpatialIndex(512);
    for (let i = 0; i < 10000; i++) {
      idx.set(`n${i}`, { x: (i % 100) * 200, y: Math.floor(i / 100) * 120, width: 150, height: 60 });
    }
    const t0 = performance.now();
    let total = 0;
    for (let q = 0; q < 100; q++) {
      total += idx.query({ x: q * 37, y: q * 21, width: 1200, height: 800 }).size;
    }
    const ms = performance.now() - t0;
    expect(total).toBeGreaterThan(0);
    // 100 viewport queries over 10k nodes should be far under a frame budget.
    expect(ms).toBeLessThan(100);
  });
});
