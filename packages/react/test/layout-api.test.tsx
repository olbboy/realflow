// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ReFlow, type ReflowApi } from '@reflow/react';
import type { Node, Edge } from '@reflow/core';

afterEach(cleanup);

const nodes: Node[] = [
  { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' }, width: 120, height: 40 },
  { id: 'b', position: { x: 300, y: 0 }, data: { label: 'B' }, width: 120, height: 40 },
];
const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];

describe('layout API', () => {
  it('layoutAsync resolves and positions the graph', async () => {
    let api: ReflowApi | null = null;
    render(<ReFlow defaultNodes={nodes} defaultEdges={edges} fitViewOnInit={false} onInit={(a) => (api = a)} />);
    await act(async () => {
      await api!.layoutAsync('layered', { fitView: false });
    });
    const x = (id: string) => api!.getNode(id)!.position.x;
    expect(x('a')).toBeLessThan(x('b'));
  });

  it('layoutIncremental places a new node without moving existing ones', () => {
    let api: ReflowApi | null = null;
    render(<ReFlow defaultNodes={nodes} defaultEdges={edges} fitViewOnInit={false} onInit={(a) => (api = a)} />);
    const before = { a: { ...api!.getNode('a')!.position }, b: { ...api!.getNode('b')!.position } };
    act(() => {
      api!.addNode({ id: 'c', position: { x: 0, y: 0 }, data: { label: 'C' }, width: 120, height: 40 });
      api!.addEdge({ id: 'e2', source: 'b', target: 'c' });
      api!.layoutIncremental(['c']);
    });
    expect(api!.getNode('a')!.position).toEqual(before.a);
    expect(api!.getNode('b')!.position).toEqual(before.b);
    expect(api!.getNode('c')!.position.x).toBeGreaterThan(before.b.x);
  });
});
