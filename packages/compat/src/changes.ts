import type { Connection, EdgeChange, NodeChange, RFEdge, RFNode } from './types';

/** React Flow's applyNodeChanges: fold change objects into a nodes array. */
export function applyNodeChanges<T = any>(
  changes: NodeChange<T>[],
  nodes: RFNode<T>[]
): RFNode<T>[] {
  let result = nodes;
  const mutate = () => (result === nodes ? (result = [...nodes]) : result);

  const indexById = new Map(nodes.map((n, i) => [n.id, i]));
  const removals = new Set<string>();

  for (const change of changes) {
    switch (change.type) {
      case 'add': {
        const arr = mutate();
        if (change.index != null) arr.splice(change.index, 0, change.item);
        else arr.push(change.item);
        break;
      }
      case 'remove':
        removals.add(change.id);
        break;
      case 'replace': {
        const i = indexById.get(change.id);
        if (i != null) mutate()[i] = change.item;
        break;
      }
      case 'position': {
        const i = indexById.get(change.id);
        if (i != null) {
          const arr = mutate();
          arr[i] = {
            ...arr[i],
            ...(change.position ? { position: change.position } : {}),
            dragging: change.dragging,
          };
        }
        break;
      }
      case 'dimensions': {
        const i = indexById.get(change.id);
        if (i != null && change.dimensions) {
          const arr = mutate();
          arr[i] = { ...arr[i], width: change.dimensions.width, height: change.dimensions.height };
        }
        break;
      }
      case 'select': {
        const i = indexById.get(change.id);
        if (i != null) {
          const arr = mutate();
          arr[i] = { ...arr[i], selected: change.selected };
        }
        break;
      }
    }
  }

  if (removals.size > 0) result = (result === nodes ? nodes : result).filter((n) => !removals.has(n.id));
  return result;
}

/** React Flow's applyEdgeChanges. */
export function applyEdgeChanges<T = any>(
  changes: EdgeChange<T>[],
  edges: RFEdge<T>[]
): RFEdge<T>[] {
  let result = edges;
  const mutate = () => (result === edges ? (result = [...edges]) : result);
  const indexById = new Map(edges.map((e, i) => [e.id, i]));
  const removals = new Set<string>();

  for (const change of changes) {
    switch (change.type) {
      case 'add': {
        const arr = mutate();
        if (change.index != null) arr.splice(change.index, 0, change.item);
        else arr.push(change.item);
        break;
      }
      case 'remove':
        removals.add(change.id);
        break;
      case 'replace': {
        const i = indexById.get(change.id);
        if (i != null) mutate()[i] = change.item;
        break;
      }
      case 'select': {
        const i = indexById.get(change.id);
        if (i != null) {
          const arr = mutate();
          arr[i] = { ...arr[i], selected: change.selected };
        }
        break;
      }
    }
  }

  if (removals.size > 0) result = (result === edges ? edges : result).filter((e) => !removals.has(e.id));
  return result;
}

/** React Flow's addEdge: append a connection as an edge (dedup + id). */
export function addEdge<T = any>(
  connection: Connection | RFEdge<T>,
  edges: RFEdge<T>[]
): RFEdge<T>[] {
  const { source, target } = connection;
  if (source == null || target == null) return edges;
  const sourceHandle = (connection as Connection).sourceHandle ?? null;
  const targetHandle = (connection as Connection).targetHandle ?? null;

  const exists = edges.some(
    (e) =>
      e.source === source &&
      e.target === target &&
      (e.sourceHandle ?? null) === sourceHandle &&
      (e.targetHandle ?? null) === targetHandle
  );
  if (exists) return edges;

  const id =
    (connection as RFEdge).id ??
    `reactflow__edge-${source}${sourceHandle ?? ''}-${target}${targetHandle ?? ''}`;
  const edge = {
    ...(connection as Partial<RFEdge<T>>),
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
  } as RFEdge<T>;
  return [...edges, edge];
}

/** React Flow's reconnectEdge: move an edge's endpoint to a new connection. */
export function reconnectEdge<T = any>(
  oldEdge: RFEdge<T>,
  newConnection: Connection,
  edges: RFEdge<T>[]
): RFEdge<T>[] {
  const { source, target, sourceHandle, targetHandle } = newConnection;
  if (source == null || target == null) return edges;
  const id = `reactflow__edge-${source}${sourceHandle ?? ''}-${target}${targetHandle ?? ''}`;
  return edges.map((e) =>
    e.id === oldEdge.id
      ? { ...e, source, target, sourceHandle, targetHandle, id }
      : e
  );
}
