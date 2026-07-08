// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import { RealFlow, useRealFlow, type RealFlowApi } from '@realflow/react';
import type { Edge, Node } from '@realflow/core';

afterEach(cleanup);

const nodes: Node[] = [
  { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Alpha' } },
  { id: 'b', position: { x: 240, y: 120 }, data: { label: 'Beta' } },
];
const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];

describe('<RealFlow>', () => {
  it('renders nodes and edges from defaultNodes/defaultEdges', () => {
    const { container } = render(
      <div style={{ width: 800, height: 600 }}>
        <RealFlow defaultNodes={nodes} defaultEdges={edges} fitViewOnInit={false} />
      </div>
    );
    expect(container.querySelectorAll('.rf-node')).toHaveLength(2);
    expect(container.querySelectorAll('.rf-edge')).toHaveLength(1);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('exposes the imperative api via onInit: add/remove/undo', async () => {
    let api: RealFlowApi | null = null;
    const { container } = render(
      <RealFlow
        defaultNodes={nodes}
        defaultEdges={edges}
        fitViewOnInit={false}
        onInit={(a) => {
          api = a;
        }}
      />
    );
    expect(api).not.toBeNull();
    await act(async () => {
      api!.addNode({ id: 'c', position: { x: 500, y: 0 }, data: { label: 'Gamma' } });
    });
    expect(container.querySelectorAll('.rf-node')).toHaveLength(3);
    await act(async () => {
      api!.undo();
    });
    expect(container.querySelectorAll('.rf-node')).toHaveLength(2);
    await act(async () => {
      api!.redo();
    });
    expect(screen.getByText('Gamma')).toBeTruthy();
  });

  it('reflects selection in the DOM and fires onSelectionChange', async () => {
    let api: RealFlowApi | null = null;
    const onSelectionChange = vi.fn();
    const { container } = render(
      <RealFlow
        defaultNodes={nodes}
        fitViewOnInit={false}
        onInit={(a) => {
          api = a;
        }}
        onSelectionChange={onSelectionChange}
      />
    );
    await act(async () => {
      api!.setSelection(['a']);
    });
    expect(container.querySelector('.rf-node[data-id="a"]')!.className).toContain('rf-selected');
    expect(onSelectionChange).toHaveBeenCalledWith({ nodes: ['a'], edges: [] });
  });

  it('controlled mode: onNodesChange fires after mutations commit', async () => {
    let api: RealFlowApi | null = null;
    const onNodesChange = vi.fn();
    render(
      <RealFlow
        nodes={nodes}
        edges={edges}
        fitViewOnInit={false}
        onInit={(a) => {
          api = a;
        }}
        onNodesChange={onNodesChange}
      />
    );
    await act(async () => {
      api!.updateNodeData('a', { label: 'Alpha 2' });
    });
    expect(onNodesChange).toHaveBeenCalled();
    const latest = onNodesChange.mock.lastCall![0] as Node[];
    expect(latest.find((n) => n.id === 'a')!.data.label).toBe('Alpha 2');
  });

  it('custom node types receive typed props', () => {
    const Custom = vi.fn(({ data }: { data: { label?: string } }) => (
      <div className="custom-node">{data.label}</div>
    ));
    render(
      <RealFlow
        defaultNodes={[{ id: 'x', type: 'fancy', position: { x: 0, y: 0 }, data: { label: 'Fancy!' } }]}
        nodeTypes={{ fancy: Custom as never }}
        fitViewOnInit={false}
      />
    );
    expect(screen.getByText('Fancy!')).toBeTruthy();
    expect(Custom).toHaveBeenCalled();
  });

  it('hooks work under RealFlow children (useRealFlow)', async () => {
    let seen: number | null = null;
    const Probe = (): null => {
      const api = useRealFlow();
      seen = api.getNodes().length;
      return null;
    };
    render(
      <RealFlow defaultNodes={nodes} fitViewOnInit={false}>
        <Probe />
      </RealFlow>
    );
    expect(seen).toBe(2);
  });

  it('renders edge labels and markers', () => {
    const { container } = render(
      <RealFlow
        defaultNodes={nodes}
        defaultEdges={[
          {
            id: 'e1',
            source: 'a',
            target: 'b',
            label: 'flows',
            markerEnd: { type: 'arrowclosed' },
          },
        ]}
        fitViewOnInit={false}
      />
    );
    expect(screen.getByText('flows')).toBeTruthy();
    const path = container.querySelector('.rf-edge-path')!;
    expect(path.getAttribute('marker-end')).toBe('url(#rf-m-arrowclosed)');
  });
});
