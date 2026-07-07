// Shared, deterministic scene generator so both libraries render the exact
// same graph. No randomness — reproducible across runs and machines.

export interface SceneNode {
  id: string;
  x: number;
  y: number;
  label: string;
}
export interface SceneEdge {
  id: string;
  source: string;
  target: string;
}

export interface Scene {
  nodes: SceneNode[];
  edges: SceneEdge[];
}

/**
 * `n` nodes in a grid, each connected to a parent (a wide tree) so edge
 * count ≈ node count — representative of real flow editors.
 */
export function makeScene(n: number): Scene {
  const nodes: SceneNode[] = [];
  const edges: SceneEdge[] = [];
  const cols = Math.ceil(Math.sqrt(n) * 1.5);
  for (let i = 0; i < n; i++) {
    nodes.push({
      id: `n${i}`,
      x: (i % cols) * 220,
      y: Math.floor(i / cols) * 120,
      label: `Node ${i}`,
    });
    if (i > 0) {
      edges.push({ id: `e${i}`, source: `n${Math.floor((i - 1) / 2)}`, target: `n${i}` });
    }
  }
  return { nodes, edges };
}

export function sceneSizeFromUrl(): number {
  const p = new URLSearchParams(location.search);
  return parseInt(p.get('n') ?? '1000', 10);
}
