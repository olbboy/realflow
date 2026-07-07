import type { XY } from './types';
import type { FlowStore } from './store';

/**
 * Built-in auto-layout. Five algorithms, zero external dependencies —
 * no dagre, no elkjs, no d3-hierarchy required.
 */

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export type LayoutDirection = 'LR' | 'RL' | 'TB' | 'BT';

export interface LayeredOptions {
  direction?: LayoutDirection;
  /** Gap between nodes in the same rank. */
  nodeGap?: number;
  /** Gap between ranks. */
  rankGap?: number;
}

export type Positions = Map<string, XY>;

interface Adj {
  out: Map<string, string[]>;
  inc: Map<string, string[]>;
}

const buildAdj = (nodes: LayoutNode[], edges: LayoutEdge[]): Adj => {
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    out.set(n.id, []);
    inc.set(n.id, []);
  }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
    out.get(e.source)!.push(e.target);
    inc.get(e.target)!.push(e.source);
  }
  return { out, inc };
};

/** DFS-based greedy cycle breaking: back edges get reversed. */
const acyclicAdj = (nodes: LayoutNode[], adj: Adj): Adj => {
  const state = new Map<string, 0 | 1 | 2>(); // 0 unvisited, 1 in-stack, 2 done
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  for (const n of nodes) {
    out.set(n.id, []);
    inc.set(n.id, []);
    state.set(n.id, 0);
  }
  const visit = (id: string): void => {
    state.set(id, 1);
    for (const t of adj.out.get(id) ?? []) {
      if (state.get(t) === 1) {
        // Back edge: reverse it.
        out.get(t)!.push(id);
        inc.get(id)!.push(t);
        continue;
      }
      out.get(id)!.push(t);
      inc.get(t)!.push(id);
      if (state.get(t) === 0) visit(t);
    }
    state.set(id, 2);
  };
  for (const n of nodes) if (state.get(n.id) === 0) visit(n.id);
  return { out, inc };
};

/**
 * Sugiyama-style layered layout: longest-path ranking, barycenter ordering
 * sweeps, then size-aware coordinate assignment. Handles cycles.
 */
export const layeredLayout = (
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  opts: LayeredOptions = {}
): Positions => {
  const positions: Positions = new Map();
  if (nodes.length === 0) return positions;
  const { direction = 'LR', nodeGap = 48, rankGap = 96 } = opts;

  const adj = acyclicAdj(nodes, buildAdj(nodes, edges));

  // 1. Rank via longest path from sources (iterative DFS with memo).
  const rank = new Map<string, number>();
  const computeRank = (id: string): number => {
    const cached = rank.get(id);
    if (cached != null) return cached;
    rank.set(id, 0); // guard against residual cycles
    let r = 0;
    for (const p of adj.inc.get(id) ?? []) r = Math.max(r, computeRank(p) + 1);
    rank.set(id, r);
    return r;
  };
  for (const n of nodes) computeRank(n.id);

  // Pull sources next to their first successor (avoids rank-0 stacking).
  for (const n of nodes) {
    if ((adj.inc.get(n.id) ?? []).length === 0) {
      const succs = adj.out.get(n.id) ?? [];
      if (succs.length > 0) {
        let min = Infinity;
        for (const s of succs) min = Math.min(min, rank.get(s)!);
        if (min - 1 > rank.get(n.id)!) rank.set(n.id, min - 1);
      }
    }
  }

  // 2. Group into layers.
  const maxRank = Math.max(...rank.values());
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const n of nodes) layers[rank.get(n.id)!].push(n.id);

  // 3. Barycenter ordering sweeps.
  const orderIndex = new Map<string, number>();
  const reindex = (): void => {
    for (const layer of layers) layer.forEach((id, i) => orderIndex.set(id, i));
  };
  reindex();
  const sweep = (down: boolean): void => {
    const seq = down
      ? layers.slice(1).map((_, i) => i + 1)
      : layers.slice(0, -1).map((_, i) => layers.length - 2 - i);
    for (const li of seq) {
      const refs = down ? adj.inc : adj.out;
      layers[li].sort((a, b) => {
        const bary = (id: string): number => {
          const neighbors = refs.get(id) ?? [];
          if (neighbors.length === 0) return orderIndex.get(id)!;
          let sum = 0;
          for (const nb of neighbors) sum += orderIndex.get(nb)!;
          return sum / neighbors.length;
        };
        return bary(a) - bary(b);
      });
      layers[li].forEach((id, i) => orderIndex.set(id, i));
    }
    reindex();
  };
  for (let i = 0; i < 4; i++) {
    sweep(true);
    sweep(false);
  }

  // 4. Coordinates. Main axis follows direction; cross axis stacks nodes.
  const sizeOf = new Map(nodes.map((n) => [n.id, n]));
  const horizontal = direction === 'LR' || direction === 'RL';
  const mainSize = (id: string): number =>
    horizontal ? sizeOf.get(id)!.width : sizeOf.get(id)!.height;
  const crossSize = (id: string): number =>
    horizontal ? sizeOf.get(id)!.height : sizeOf.get(id)!.width;

  // Cross-axis placement per layer, centered around 0.
  const crossPos = new Map<string, number>();
  for (const layer of layers) {
    let total = 0;
    for (const id of layer) total += crossSize(id);
    total += nodeGap * Math.max(0, layer.length - 1);
    let cursor = -total / 2;
    for (const id of layer) {
      crossPos.set(id, cursor);
      cursor += crossSize(id) + nodeGap;
    }
  }

  // Cross-axis refinement: pull nodes toward the mean of their neighbors,
  // then resolve overlaps. A cheap substitute for Brandes-Köpf that looks
  // good in practice.
  for (let iter = 0; iter < 3; iter++) {
    for (const layer of layers) {
      const desired = layer.map((id) => {
        const nbs = [...(adj.inc.get(id) ?? []), ...(adj.out.get(id) ?? [])];
        if (nbs.length === 0) return crossPos.get(id)!;
        let sum = 0;
        for (const nb of nbs) sum += crossPos.get(nb)! + crossSize(nb) / 2;
        return sum / nbs.length - crossSize(id) / 2;
      });
      layer.forEach((id, i) => crossPos.set(id, desired[i]));
      // Resolve overlaps preserving order.
      for (let i = 1; i < layer.length; i++) {
        const prev = layer[i - 1];
        const minPos = crossPos.get(prev)! + crossSize(prev) + nodeGap;
        if (crossPos.get(layer[i])! < minPos) crossPos.set(layer[i], minPos);
      }
      for (let i = layer.length - 2; i >= 0; i--) {
        const next = layer[i + 1];
        const maxPos = crossPos.get(next)! - nodeGap - crossSize(layer[i]);
        if (crossPos.get(layer[i])! > maxPos) crossPos.set(layer[i], maxPos);
      }
    }
  }

  // Main-axis: cumulative layer thickness.
  const layerThickness = layers.map((layer) =>
    layer.length > 0 ? Math.max(...layer.map(mainSize)) : 0
  );
  const mainStart: number[] = [];
  let acc = 0;
  for (let i = 0; i < layers.length; i++) {
    mainStart.push(acc);
    acc += layerThickness[i] + rankGap;
  }
  const totalMain = acc - rankGap;

  for (const n of nodes) {
    const r = rank.get(n.id)!;
    // Center within the layer band.
    let main = mainStart[r] + (layerThickness[r] - mainSize(n.id)) / 2;
    if (direction === 'RL' || direction === 'BT') {
      main = totalMain - main - mainSize(n.id);
    }
    const cross = crossPos.get(n.id)!;
    positions.set(n.id, horizontal ? { x: main, y: cross } : { x: cross, y: main });
  }
  return positions;
};

export interface TreeOptions {
  direction?: LayoutDirection;
  nodeGap?: number;
  rankGap?: number;
}

/**
 * Tidy tree layout: children are laid out below/beside their parent, parents
 * centered over their subtrees. Non-tree edges are ignored (BFS tree).
 */
export const treeLayout = (
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  opts: TreeOptions = {}
): Positions => {
  const { direction = 'TB', nodeGap = 32, rankGap = 80 } = opts;
  const positions: Positions = new Map();
  if (nodes.length === 0) return positions;

  const adj = buildAdj(nodes, edges);
  const horizontal = direction === 'LR' || direction === 'RL';
  const sizeOf = new Map(nodes.map((n) => [n.id, n]));
  const crossSize = (id: string): number =>
    horizontal ? sizeOf.get(id)!.height : sizeOf.get(id)!.width;
  const mainSize = (id: string): number =>
    horizontal ? sizeOf.get(id)!.width : sizeOf.get(id)!.height;

  // Roots: indegree 0 (fall back to first node of each component).
  const roots = nodes.filter((n) => (adj.inc.get(n.id) ?? []).length === 0).map((n) => n.id);
  const seen = new Set<string>(roots);
  // BFS tree children.
  const treeKids = new Map<string, string[]>();
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const kids: string[] = [];
    for (const t of adj.out.get(id) ?? []) {
      if (!seen.has(t)) {
        seen.add(t);
        kids.push(t);
        queue.push(t);
      }
    }
    treeKids.set(id, kids);
  }
  // Orphans in cycles become extra roots.
  for (const n of nodes) {
    if (!seen.has(n.id)) {
      roots.push(n.id);
      seen.add(n.id);
      const kids: string[] = [];
      const q2 = [n.id];
      while (q2.length > 0) {
        const id = q2.shift()!;
        const ks: string[] = [];
        for (const t of adj.out.get(id) ?? []) {
          if (!seen.has(t)) {
            seen.add(t);
            ks.push(t);
            q2.push(t);
          }
        }
        treeKids.set(id, ks);
        kids.push(...ks);
      }
    }
  }

  const cross = new Map<string, number>();
  const depth = new Map<string, number>();
  let cursor = 0;
  const place = (id: string, d: number): { min: number; max: number } => {
    depth.set(id, d);
    const kids = treeKids.get(id) ?? [];
    if (kids.length === 0) {
      cross.set(id, cursor);
      const r = { min: cursor, max: cursor + crossSize(id) };
      cursor += crossSize(id) + nodeGap;
      return r;
    }
    let min = Infinity;
    let max = -Infinity;
    let firstMid = 0;
    let lastMid = 0;
    kids.forEach((kid, i) => {
      const ext = place(kid, d + 1);
      min = Math.min(min, ext.min);
      max = Math.max(max, ext.max);
      const mid = cross.get(kid)! + crossSize(kid) / 2;
      if (i === 0) firstMid = mid;
      lastMid = mid;
    });
    const center = (firstMid + lastMid) / 2;
    cross.set(id, center - crossSize(id) / 2);
    return { min: Math.min(min, cross.get(id)!), max: Math.max(max, cross.get(id)! + crossSize(id)) };
  };
  for (const root of roots) place(root, 0);

  // Main axis: per-depth thickness.
  const maxDepth = Math.max(...depth.values());
  const thickness: number[] = Array.from({ length: maxDepth + 1 }, () => 0);
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    thickness[d] = Math.max(thickness[d], mainSize(n.id));
  }
  const mainStart: number[] = [];
  let acc = 0;
  for (let d = 0; d <= maxDepth; d++) {
    mainStart.push(acc);
    acc += thickness[d] + rankGap;
  }
  const totalMain = acc - rankGap;

  for (const n of nodes) {
    const d = depth.get(n.id)!;
    let main = mainStart[d] + (thickness[d] - mainSize(n.id)) / 2;
    if (direction === 'RL' || direction === 'BT') main = totalMain - main - mainSize(n.id);
    const c = cross.get(n.id)!;
    positions.set(n.id, horizontal ? { x: main, y: c } : { x: c, y: main });
  }
  return positions;
};

export interface ForceOptions {
  iterations?: number;
  /** Ideal edge length. */
  linkDistance?: number;
  /** Initial positions (defaults to a circle). */
  initial?: Positions;
  /** Deterministic seed for the initial circle jitter. */
  seed?: number;
}

/** Fruchterman–Reingold force layout with grid-bucketed repulsion. */
export const forceLayout = (
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  opts: ForceOptions = {}
): Positions => {
  const positions: Positions = new Map();
  const n = nodes.length;
  if (n === 0) return positions;
  const { iterations = 250, linkDistance = 180, seed = 42 } = opts;

  // Deterministic PRNG (mulberry32) so layouts are reproducible.
  let s = seed >>> 0;
  const rand = (): number => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const idx = new Map(nodes.map((node, i) => [node.id, i]));
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  const radius = (linkDistance * Math.sqrt(n)) / 2;
  nodes.forEach((node, i) => {
    const init = opts.initial?.get(node.id);
    if (init) {
      px[i] = init.x;
      py[i] = init.y;
    } else {
      const angle = (i / n) * Math.PI * 2;
      px[i] = Math.cos(angle) * radius + (rand() - 0.5) * linkDistance;
      py[i] = Math.sin(angle) * radius + (rand() - 0.5) * linkDistance;
    }
  });

  const links: [number, number][] = [];
  for (const e of edges) {
    const a = idx.get(e.source);
    const b = idx.get(e.target);
    if (a != null && b != null && a !== b) links.push([a, b]);
  }

  const k = linkDistance;
  const k2 = k * k;
  let temp = radius / 4;
  const cool = Math.pow(0.01, 1 / iterations);

  for (let iter = 0; iter < iterations; iter++) {
    dx.fill(0);
    dy.fill(0);

    // Repulsion via uniform grid: only nearby buckets interact.
    const cell = k * 2;
    const grid = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const key = `${Math.floor(px[i] / cell)}:${Math.floor(py[i] / cell)}`;
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(i);
    }
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(px[i] / cell);
      const cy = Math.floor(py[i] / cell);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = grid.get(`${gx}:${gy}`);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j === i) continue;
            let ddx = px[i] - px[j];
            let ddy = py[i] - py[j];
            let d2 = ddx * ddx + ddy * ddy;
            if (d2 < 0.01) {
              ddx = rand() - 0.5;
              ddy = rand() - 0.5;
              d2 = ddx * ddx + ddy * ddy;
            }
            const f = k2 / d2;
            dx[i] += ddx * f;
            dy[i] += ddy * f;
          }
        }
      }
    }

    // Attraction along links.
    for (const [a, b] of links) {
      const ddx = px[a] - px[b];
      const ddy = py[a] - py[b];
      const d = Math.sqrt(ddx * ddx + ddy * ddy) || 0.01;
      const f = (d * d) / k / d;
      dx[a] -= ddx * f;
      dy[a] -= ddy * f;
      dx[b] += ddx * f;
      dy[b] += ddy * f;
    }

    for (let i = 0; i < n; i++) {
      const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 0.01;
      const lim = Math.min(d, temp);
      px[i] += (dx[i] / d) * lim;
      py[i] += (dy[i] / d) * lim;
    }
    temp *= cool;
  }

  nodes.forEach((node, i) => {
    positions.set(node.id, {
      x: px[i] - node.width / 2,
      y: py[i] - node.height / 2,
    });
  });
  return positions;
};

export interface GridOptions {
  /** Columns; defaults to ceil(sqrt(n)). */
  columns?: number;
  gap?: number;
}

/** Uniform grid placement in current order. */
export const gridLayout = (nodes: LayoutNode[], opts: GridOptions = {}): Positions => {
  const positions: Positions = new Map();
  if (nodes.length === 0) return positions;
  const columns = opts.columns ?? Math.ceil(Math.sqrt(nodes.length));
  const gap = opts.gap ?? 48;
  const colWidth = Math.max(...nodes.map((n) => n.width)) + gap;
  const rowHeight = Math.max(...nodes.map((n) => n.height)) + gap;
  nodes.forEach((n, i) => {
    positions.set(n.id, {
      x: (i % columns) * colWidth,
      y: Math.floor(i / columns) * rowHeight,
    });
  });
  return positions;
};

export interface RadialOptions {
  /** Gap between rings. */
  ringGap?: number;
}

/** Concentric rings by BFS depth from the roots. */
export const radialLayout = (
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  opts: RadialOptions = {}
): Positions => {
  const positions: Positions = new Map();
  if (nodes.length === 0) return positions;
  const ringGap = opts.ringGap ?? 160;
  const adj = buildAdj(nodes, edges);

  const roots = nodes.filter((n) => (adj.inc.get(n.id) ?? []).length === 0).map((n) => n.id);
  const start = roots.length > 0 ? roots : [nodes[0].id];
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const r of start) {
    depth.set(r, 0);
    queue.push(r);
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = depth.get(id)!;
    for (const t of [...(adj.out.get(id) ?? []), ...(adj.inc.get(id) ?? [])]) {
      if (!depth.has(t)) {
        depth.set(t, d + 1);
        queue.push(t);
      }
    }
  }
  for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, 1);

  const rings = new Map<number, string[]>();
  for (const [id, d] of depth) {
    let ring = rings.get(d);
    if (!ring) {
      ring = [];
      rings.set(d, ring);
    }
    ring.push(id);
  }
  const sizeOf = new Map(nodes.map((n) => [n.id, n]));
  for (const [d, ring] of rings) {
    const r = d * ringGap;
    ring.forEach((id, i) => {
      const angle = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
      const node = sizeOf.get(id)!;
      positions.set(id, {
        x: Math.cos(angle) * r - node.width / 2,
        y: Math.sin(angle) * r - node.height / 2,
      });
    });
  }
  return positions;
};

export type LayoutType = 'layered' | 'tree' | 'force' | 'grid' | 'radial';

export interface LayoutOptions extends LayeredOptions, ForceOptions, GridOptions, RadialOptions {
  /** Only lay out these nodes (defaults to all root-level nodes). */
  nodes?: string[];
  /** Animate node movement (ms) — handled by applyLayout. */
  duration?: number;
  /** Fit the view afterwards. */
  fitView?: boolean;
}

/** Compute a layout for the store's root-level nodes. */
export const computeLayout = (
  store: FlowStore,
  type: LayoutType,
  opts: LayoutOptions = {}
): Positions => {
  const include = opts.nodes ? new Set(opts.nodes) : null;
  const layoutNodes: LayoutNode[] = [];
  for (const node of store.getNodes()) {
    if (node.parentId || node.hidden) continue;
    if (include && !include.has(node.id)) continue;
    const size = store.nodeSize(node.id);
    layoutNodes.push({ id: node.id, width: size.width, height: size.height });
  }
  const idSet = new Set(layoutNodes.map((n) => n.id));
  // Edges attached to nested children count as edges between their root
  // ancestors, so groups participate in the layout sensibly.
  const rootOf = (id: string): string => {
    let cur = store.getNode(id);
    let guard = 0;
    while (cur?.parentId && guard++ < 100) {
      const parent = store.getNode(cur.parentId);
      if (!parent) break;
      cur = parent;
    }
    return cur?.id ?? id;
  };
  const layoutEdges: LayoutEdge[] = [];
  const seen = new Set<string>();
  for (const e of store.getEdges()) {
    const source = idSet.has(e.source) ? e.source : rootOf(e.source);
    const target = idSet.has(e.target) ? e.target : rootOf(e.target);
    if (!idSet.has(source) || !idSet.has(target) || source === target) continue;
    const key = `${source}→${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    layoutEdges.push({ source, target });
  }
  switch (type) {
    case 'layered':
      return layeredLayout(layoutNodes, layoutEdges, opts);
    case 'tree':
      return treeLayout(layoutNodes, layoutEdges, opts);
    case 'force':
      return forceLayout(layoutNodes, layoutEdges, {
        ...opts,
        initial:
          opts.initial ??
          new Map(layoutNodes.map((n) => [n.id, store.getNode(n.id)!.position])),
      });
    case 'grid':
      return gridLayout(layoutNodes, opts);
    case 'radial':
      return radialLayout(layoutNodes, layoutEdges, opts);
  }
};

/** Apply computed positions as a single undoable transaction. */
export const applyLayout = (store: FlowStore, positions: Positions): void => {
  store.transact('layout', () => {
    for (const [id, pos] of positions) {
      const node = store.getNode(id);
      if (!node) continue;
      if (node.position.x !== pos.x || node.position.y !== pos.y) {
        store.setNodePosition(id, pos);
      }
    }
  });
};

export interface IncrementalOptions {
  /** Gap kept from existing nodes when placing new ones. Default 40. */
  gap?: number;
  /** Preferred offset from a connected neighbor. Default 220 (x), 120 (y). */
  stepX?: number;
  stepY?: number;
}

/**
 * Position only the given new nodes, leaving the existing graph untouched —
 * so adding one node doesn't reshuffle the whole diagram. Each new node is
 * placed next to its already-positioned neighbors (downstream of a source),
 * then nudged to avoid overlapping existing nodes. Nodes with no positioned
 * neighbor are dropped into free space below the current bounds.
 *
 * Returns the computed positions (does not mutate the store — pair with
 * `applyLayout`).
 */
export const incrementalLayout = (
  store: FlowStore,
  newNodeIds: string[],
  opts: IncrementalOptions = {}
): Positions => {
  const gap = opts.gap ?? 40;
  const stepX = opts.stepX ?? 220;
  const stepY = opts.stepY ?? 120;
  const positions: Positions = new Map();
  const isNew = new Set(newNodeIds);

  // Rects of the existing (already-placed) nodes, for overlap avoidance.
  const placed: { id: string; x: number; y: number; w: number; h: number }[] = [];
  let bounds = store.nodesBounds(store.getNodes().filter((n) => !isNew.has(n.id)).map((n) => n.id));
  for (const node of store.getNodes()) {
    if (isNew.has(node.id) || node.parentId) continue;
    const s = store.nodeSize(node.id);
    placed.push({ id: node.id, x: node.position.x, y: node.position.y, w: s.width, h: s.height });
  }

  const overlaps = (x: number, y: number, w: number, h: number): boolean => {
    for (const r of placed) {
      if (x < r.x + r.w + gap && x + w + gap > r.x && y < r.y + r.h + gap && y + h + gap > r.y) {
        return true;
      }
    }
    return false;
  };

  let fallbackY = bounds.height > 0 ? bounds.y + bounds.height + stepY : 0;
  const fallbackX0 = bounds.width > 0 ? bounds.x : 0;
  let fallbackX = fallbackX0;

  for (const id of newNodeIds) {
    const node = store.getNode(id);
    if (!node) continue;
    const size = store.nodeSize(id);

    // Anchor: average of positioned neighbors, offset downstream.
    let ax: number | null = null;
    let ay = 0;
    let count = 0;
    for (const e of store.edgesOf(id)) {
      const otherId = e.source === id ? e.target : e.source;
      if (isNew.has(otherId)) continue;
      const other = store.getNode(otherId);
      if (!other) continue;
      const os = store.nodeSize(otherId);
      // Downstream of a source, upstream-left of a target.
      const dir = e.source === otherId ? 1 : -1;
      ax = (ax ?? 0) + other.position.x + dir * (os.width + stepX - os.width);
      ay += other.position.y;
      count++;
    }

    let x: number;
    let y: number;
    if (ax != null && count > 0) {
      x = ax / count;
      y = ay / count;
    } else {
      // No positioned neighbor: drop into free space below the graph.
      x = fallbackX;
      y = fallbackY;
      fallbackX += size.width + stepX;
      if (fallbackX > fallbackX0 + 6 * stepX) {
        fallbackX = fallbackX0;
        fallbackY += stepY;
      }
    }

    // Nudge downward until it doesn't overlap an existing node.
    let guard = 0;
    while (overlaps(x, y, size.width, size.height) && guard++ < 200) {
      y += size.height + gap;
    }
    positions.set(id, { x, y });
    placed.push({ id, x, y, w: size.width, h: size.height });
  }
  return positions;
};

/** Convenience: compute + apply + optionally fit the view. */
export const layout = (store: FlowStore, type: LayoutType, opts: LayoutOptions = {}): void => {
  applyLayout(store, computeLayout(store, type, opts));
  if (opts.fitView !== false) {
    store.fitView({ duration: opts.duration ?? 300, padding: 0.12 });
  }
};
