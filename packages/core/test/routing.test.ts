import { describe, expect, it } from 'vitest';
import { routeOrthogonal, simplifyOrthogonal, type Rect } from '@realflow/core';

const isOrthogonal = (pts: { x: number; y: number }[]): boolean => {
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i].x - pts[i - 1].x);
    const dy = Math.abs(pts[i].y - pts[i - 1].y);
    if (dx > 1e-6 && dy > 1e-6) return false;
  }
  return true;
};

/** Does the polyline pass through the interior of the rect? */
const crossesRect = (pts: { x: number; y: number }[], r: Rect, pad = 2): boolean => {
  const x0 = r.x + pad;
  const y0 = r.y + pad;
  const x1 = r.x + r.width - pad;
  const y1 = r.y + r.height - pad;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const sx0 = Math.min(a.x, b.x);
    const sx1 = Math.max(a.x, b.x);
    const sy0 = Math.min(a.y, b.y);
    const sy1 = Math.max(a.y, b.y);
    if (sx0 < x1 && sx1 > x0 && sy0 < y1 && sy1 > y0) return true;
  }
  return false;
};

describe('routeOrthogonal', () => {
  it('produces an orthogonal path between two points with no obstacles', () => {
    const path = routeOrthogonal({
      source: { x: 0, y: 0 },
      sourceSide: 'right',
      target: { x: 300, y: 120 },
      targetSide: 'left',
      obstacles: [],
    });
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 300, y: 120 });
    expect(isOrthogonal(path)).toBe(true);
  });

  it('routes AROUND an obstacle directly between source and target', () => {
    // Obstacle sits squarely on the straight line from source to target.
    const obstacle: Rect = { x: 120, y: -40, width: 80, height: 120 };
    const path = routeOrthogonal({
      source: { x: 0, y: 20 },
      sourceSide: 'right',
      target: { x: 320, y: 20 },
      targetSide: 'left',
      obstacles: [obstacle],
      padding: 10,
    });
    expect(isOrthogonal(path)).toBe(true);
    expect(crossesRect(path, obstacle)).toBe(false);
    // It must actually deviate (more than a straight 2-point line).
    expect(path.length).toBeGreaterThan(2);
  });

  it('avoids multiple stacked obstacles', () => {
    const obstacles: Rect[] = [
      { x: 100, y: -60, width: 60, height: 80 },
      { x: 100, y: 60, width: 60, height: 80 },
      { x: 220, y: 0, width: 60, height: 80 },
    ];
    const path = routeOrthogonal({
      source: { x: 0, y: 40 },
      sourceSide: 'right',
      target: { x: 380, y: 40 },
      targetSide: 'left',
      obstacles,
      padding: 8,
    });
    expect(isOrthogonal(path)).toBe(true);
    for (const o of obstacles) expect(crossesRect(path, o), `crosses ${JSON.stringify(o)}`).toBe(false);
  });

  it('does not treat the source/target own nodes as blocking', () => {
    // Endpoints sit on the borders of their own node rects.
    const sourceNode: Rect = { x: -100, y: 0, width: 100, height: 40 };
    const targetNode: Rect = { x: 300, y: 0, width: 100, height: 40 };
    const path = routeOrthogonal({
      source: { x: 0, y: 20 }, // right border of sourceNode
      sourceSide: 'right',
      target: { x: 300, y: 20 }, // left border of targetNode
      targetSide: 'left',
      obstacles: [sourceNode, targetNode],
    });
    expect(path[0]).toEqual({ x: 0, y: 20 });
    expect(path[path.length - 1]).toEqual({ x: 300, y: 20 });
    expect(isOrthogonal(path)).toBe(true);
  });

  it('falls back gracefully when the lattice would be huge', () => {
    const obstacles: Rect[] = [];
    for (let i = 0; i < 200; i++) obstacles.push({ x: i * 30, y: (i % 5) * 30, width: 20, height: 20 });
    const path = routeOrthogonal({
      source: { x: 0, y: 0 },
      sourceSide: 'right',
      target: { x: 1000, y: 500 },
      targetSide: 'left',
      obstacles,
      maxLatticePoints: 500,
    });
    // Fallback still returns a valid orthogonal path.
    expect(isOrthogonal(path)).toBe(true);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 1000, y: 500 });
  });

  it('is reasonably fast for a realistic obstacle field', () => {
    const obstacles: Rect[] = [];
    for (let i = 0; i < 40; i++) {
      obstacles.push({ x: (i % 8) * 180, y: Math.floor(i / 8) * 120, width: 140, height: 60 });
    }
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      routeOrthogonal({
        source: { x: 0, y: 30 },
        sourceSide: 'right',
        target: { x: 1300, y: 500 },
        targetSide: 'left',
        obstacles,
      });
    }
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(1000); // 50 routes over 40 obstacles
  });
});

describe('simplifyOrthogonal', () => {
  it('removes collinear points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ];
    expect(simplifyOrthogonal(pts)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]);
  });
});
