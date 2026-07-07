import { useCallback, useState } from 'react';
import { applyNodeChanges, applyEdgeChanges } from './changes';
import type { EdgeChange, NodeChange, RFEdge, RFNode } from './types';

/** React Flow's useNodesState: [nodes, setNodes, onNodesChange]. */
export function useNodesState<T = any>(
  initial: RFNode<T>[]
): [RFNode<T>[], (payload: RFNode<T>[] | ((n: RFNode<T>[]) => RFNode<T>[])) => void, (changes: NodeChange<T>[]) => void] {
  const [nodes, setNodes] = useState(initial);
  const onNodesChange = useCallback(
    (changes: NodeChange<T>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  return [nodes, setNodes, onNodesChange];
}

/** React Flow's useEdgesState: [edges, setEdges, onEdgesChange]. */
export function useEdgesState<T = any>(
  initial: RFEdge<T>[]
): [RFEdge<T>[], (payload: RFEdge<T>[] | ((e: RFEdge<T>[]) => RFEdge<T>[])) => void, (changes: EdgeChange<T>[]) => void] {
  const [edges, setEdges] = useState(initial);
  const onEdgesChange = useCallback(
    (changes: EdgeChange<T>[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  return [edges, setEdges, onEdgesChange];
}
