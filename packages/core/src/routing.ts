import type { Rect, Side, XY } from './types';
import { sideDir } from './geometry';

/**
 * Orthogonal edge routing with obstacle avoidance — the feature neither
 * React Flow nor ReFlow shipped before. Edges route around nodes instead of
 * cutting straight through them.
 *
 * The algorithm is an A* search over a **Hanan grid**: the lattice formed by
 * the horizontal and vertical lines through every obstacle edge (plus the
 * endpoints and their stubs). That keeps the search space O(obstacles²)
 * rather than a dense uniform grid, so routing stays fast even with many
 * nodes, while producing clean paths that hug obstacle boundaries.
 */

export interface RouteSpec {
  source: XY;
  sourceSide: Side;
  target: XY;
  targetSide: Side;
  /** Rectangles to route around (node bounds). */
  obstacles: Rect[];
  /** Clearance kept from obstacles (flow px). Default 10. */
  padding?: number;
  /** Minimum stub length leaving each handle. Default 20. */
  stub?: number;
  /** Extra cost per 90° turn — higher = straighter paths. Default 12. */
  bendPenalty?: number;
  /** Safety cap on lattice size; above it, fall back to a simple L-route. */
  maxLatticePoints?: number;
}

const uniqSorted = (nums: number[]): number[] => {
  const out = [...new Set(nums.map((n) => Math.round(n * 100) / 100))];
  out.sort((a, b) => a - b);
  return out;
};

const segmentBlocked = (
  a: XY,
  b: XY,
  obstacles: Rect[],
  pad: number
): boolean => {
  // Axis-aligned segment vs inflated obstacle interiors.
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  for (const o of obstacles) {
    const ox0 = o.x - pad;
    const oy0 = o.y - pad;
    const ox1 = o.x + o.width + pad;
    const oy1 = o.y + o.height + pad;
    // Overlap of the (thin) segment box with the obstacle's open interior.
    if (x0 < ox1 && x1 > ox0 && y0 < oy1 && y1 > oy0) return true;
  }
  return false;
};

const pointInside = (p: XY, obstacles: Rect[], pad: number): boolean => {
  for (const o of obstacles) {
    if (p.x > o.x - pad && p.x < o.x + o.width + pad && p.y > o.y - pad && p.y < o.y + o.height + pad) {
      return true;
    }
  }
  return false;
};

/** Drop collinear intermediate points from an orthogonal polyline. */
export const simplifyOrthogonal = (pts: XY[]): XY[] => {
  if (pts.length <= 2) return pts;
  const out: XY[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const collinear =
      (Math.abs(prev.x - cur.x) < 1e-6 && Math.abs(cur.x - next.x) < 1e-6) ||
      (Math.abs(prev.y - cur.y) < 1e-6 && Math.abs(cur.y - next.y) < 1e-6);
    if (!collinear) out.push(cur);
  }
  out.push(pts[pts.length - 1]);
  return out;
};

/** A simple 3-segment L/Z route used as a fallback (no obstacle avoidance). */
const simpleRoute = (s: XY, sd: XY, t: XY, td: XY, stub: number): XY[] => {
  const sg = { x: s.x + sd.x * stub, y: s.y + sd.y * stub };
  const tg = { x: t.x + td.x * stub, y: t.y + td.y * stub };
  const mid =
    sd.x !== 0
      ? [
          { x: (sg.x + tg.x) / 2, y: sg.y },
          { x: (sg.x + tg.x) / 2, y: tg.y },
        ]
      : [
          { x: sg.x, y: (sg.y + tg.y) / 2 },
          { x: tg.x, y: (sg.y + tg.y) / 2 },
        ];
  return simplifyOrthogonal([s, sg, ...mid, tg, t]);
};

/**
 * Route an orthogonal path from source to target avoiding obstacles.
 * Returns waypoints including the source and target endpoints.
 */
export const routeOrthogonal = (spec: RouteSpec): XY[] => {
  const pad = spec.padding ?? 10;
  const stub = spec.stub ?? 20;
  const bendPenalty = spec.bendPenalty ?? 12;
  const maxPts = spec.maxLatticePoints ?? 4000;

  const sd = sideDir(spec.sourceSide);
  const td = sideDir(spec.targetSide);
  const source = spec.source;
  const target = spec.target;
  const sStub = { x: source.x + sd.x * stub, y: source.y + sd.y * stub };
  const tStub = { x: target.x + td.x * stub, y: target.y + td.y * stub };

  // Only obstacles that could lie between the endpoints matter. Also drop the
  // obstacles that contain the endpoints themselves (the node we exit/enter),
  // so the stubs aren't considered blocked by their own node.
  const bboxX0 = Math.min(source.x, target.x) - 200;
  const bboxY0 = Math.min(source.y, target.y) - 200;
  const bboxX1 = Math.max(source.x, target.x) + 200;
  const bboxY1 = Math.max(source.y, target.y) + 200;
  const obstacles = spec.obstacles.filter((o) => {
    const intersectsBox =
      o.x <= bboxX1 && o.x + o.width >= bboxX0 && o.y <= bboxY1 && o.y + o.height >= bboxY0;
    if (!intersectsBox) return false;
    // Exclude obstacles that contain either endpoint (own node).
    const containsSource =
      source.x >= o.x - 1 && source.x <= o.x + o.width + 1 && source.y >= o.y - 1 && source.y <= o.y + o.height + 1;
    const containsTarget =
      target.x >= o.x - 1 && target.x <= o.x + o.width + 1 && target.y >= o.y - 1 && target.y <= o.y + o.height + 1;
    return !containsSource && !containsTarget;
  });

  // Build the Hanan lattice coordinates.
  const xs = uniqSorted([
    source.x, target.x, sStub.x, tStub.x,
    ...obstacles.flatMap((o) => [o.x - pad, o.x + o.width + pad, o.x + o.width / 2]),
  ]);
  const ys = uniqSorted([
    source.y, target.y, sStub.y, tStub.y,
    ...obstacles.flatMap((o) => [o.y - pad, o.y + o.height + pad, o.y + o.height / 2]),
  ]);

  if (xs.length * ys.length > maxPts) {
    return simpleRoute(source, sd, target, td, stub);
  }

  const xi = new Map(xs.map((v, i) => [v, i]));
  const yi = new Map(ys.map((v, i) => [v, i]));
  const key = (ix: number, iy: number): number => iy * xs.length + ix;

  const startIx = xi.get(Math.round(sStub.x * 100) / 100)!;
  const startIy = yi.get(Math.round(sStub.y * 100) / 100)!;
  const goalIx = xi.get(Math.round(tStub.x * 100) / 100)!;
  const goalIy = yi.get(Math.round(tStub.y * 100) / 100)!;
  if (startIx == null || goalIx == null) return simpleRoute(source, sd, target, td, stub);

  const pt = (ix: number, iy: number): XY => ({ x: xs[ix], y: ys[iy] });
  const goalKey = key(goalIx, goalIy);

  // A* with a turn penalty. State = (lattice point, arrival direction), so a
  // node can be re-expanded with a cheaper non-turning path. cameFrom is
  // keyed by full state string to keep reconstruction exact.
  interface Node {
    ix: number;
    iy: number;
    dir: number; // 0 none, 1 horiz, 2 vert
    g: number;
    f: number;
    state: string;
  }
  const stateKey = (ix: number, iy: number, dir: number): string => `${ix}:${iy}:${dir}`;
  const startState = stateKey(startIx, startIy, 0);
  const open: Node[] = [
    { ix: startIx, iy: startIy, dir: 0, g: 0, f: 0, state: startState },
  ];
  const best = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const heuristic = (ix: number, iy: number): number =>
    Math.abs(xs[ix] - tStub.x) + Math.abs(ys[iy] - tStub.y);

  const popMin = (): Node => {
    let mi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[mi].f) mi = i;
    return open.splice(mi, 1)[0];
  };

  let goalState: string | null = null;
  while (open.length > 0) {
    const cur = popMin();
    if (best.has(cur.state) && best.get(cur.state)! < cur.g) continue;
    if (key(cur.ix, cur.iy) === goalKey) {
      goalState = cur.state;
      break;
    }
    const neighbors: [number, number, number][] = [
      [cur.ix + 1, cur.iy, 1],
      [cur.ix - 1, cur.iy, 1],
      [cur.ix, cur.iy + 1, 2],
      [cur.ix, cur.iy - 1, 2],
    ];
    for (const [nx, ny, dir] of neighbors) {
      if (nx < 0 || nx >= xs.length || ny < 0 || ny >= ys.length) continue;
      const a = pt(cur.ix, cur.iy);
      const b = pt(nx, ny);
      if (segmentBlocked(a, b, obstacles, pad - 0.5)) continue;
      const stepCost = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      const turn = cur.dir !== 0 && cur.dir !== dir ? bendPenalty : 0;
      const g = cur.g + stepCost + turn;
      const sk = stateKey(nx, ny, dir);
      if (best.has(sk) && best.get(sk)! <= g) continue;
      best.set(sk, g);
      cameFrom.set(sk, cur.state);
      open.push({ ix: nx, iy: ny, dir, g, f: g + heuristic(nx, ny), state: sk });
    }
  }

  if (goalState == null) return simpleRoute(source, sd, target, td, stub);

  // Reconstruct lattice path from the winning goal state.
  const path: XY[] = [];
  let cur: string | undefined = goalState;
  const guard = new Set<string>();
  while (cur != null && !guard.has(cur)) {
    guard.add(cur);
    const [ixs, iys] = cur.split(':');
    path.unshift(pt(Number(ixs), Number(iys)));
    cur = cameFrom.get(cur);
  }

  // Attach the real endpoints (handle border) to the stubs.
  const full = [source, ...path, target];
  return simplifyOrthogonal(full).filter(
    // Drop any interior point that ended up inside an obstacle (rare, from
    // rounding); endpoints are always kept.
    (p, i, arr) => i === 0 || i === arr.length - 1 || !pointInside(p, obstacles, pad - 2)
  );
};
