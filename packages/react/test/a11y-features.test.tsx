// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import {
  ReFlow,
  NodeToolbar,
  NodeResizer,
  Handle,
  useReflow,
  type NodeProps,
  type ReflowApi,
} from '@reflow/react';
import { FlowStore, type Node } from '@reflow/core';

afterEach(cleanup);

const nodes: Node[] = [
  { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Alpha' } },
  { id: 'b', position: { x: 300, y: 0 }, data: { label: 'Beta' } },
  { id: 'c', position: { x: 0, y: 200 }, data: { label: 'Gamma' } },
];

describe('accessibility', () => {
  it('nodes are focusable with role, aria-label and aria-selected', () => {
    const { container } = render(<ReFlow defaultNodes={nodes} fitViewOnInit={false} />);
    const nodeEls = container.querySelectorAll<HTMLElement>('.rf-node');
    expect(nodeEls.length).toBe(3);
    for (const el of nodeEls) {
      expect(el.getAttribute('tabindex')).toBe('0');
      expect(el.getAttribute('role')).toBe('button');
      expect(el.getAttribute('aria-label')).toBeTruthy();
      expect(el.getAttribute('aria-roledescription')).toBe('node');
    }
    const a = container.querySelector('.rf-node[data-id="a"]')!;
    expect(a.getAttribute('aria-label')).toBe('Alpha');
  });

  it('focusing a node selects it', () => {
    const { container } = render(<ReFlow defaultNodes={nodes} fitViewOnInit={false} />);
    const a = container.querySelector<HTMLElement>('.rf-node[data-id="a"]')!;
    act(() => a.focus());
    expect(a.className).toContain('rf-selected');
    expect(a.getAttribute('aria-selected')).toBe('true');
  });

  it('readOnly removes nodes from the tab order', () => {
    const { container } = render(<ReFlow defaultNodes={nodes} readOnly fitViewOnInit={false} />);
    for (const el of container.querySelectorAll('.rf-node')) {
      expect(el.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('the canvas has an application role and label', () => {
    const { container } = render(<ReFlow defaultNodes={nodes} fitViewOnInit={false} />);
    const canvas = container.querySelector('.rf-container')!;
    expect(canvas.getAttribute('role')).toBe('application');
    expect(canvas.getAttribute('aria-label')).toBeTruthy();
  });
});

describe('nearestNodeInDirection (spatial keyboard nav)', () => {
  it('finds the node to the right / below', () => {
    const store = new FlowStore({ nodes });
    expect(store.nearestNodeInDirection('a', 'right')).toBe('b');
    expect(store.nearestNodeInDirection('a', 'down')).toBe('c');
    expect(store.nearestNodeInDirection('a', 'left')).toBeNull();
    expect(store.nearestNodeInDirection('b', 'left')).toBe('a');
  });
});

describe('NodeToolbar & NodeResizer render inside a selected node', () => {
  function ToolbarNode({ data }: NodeProps) {
    return (
      <div className="tb-node">
        <Handle kind="target" side="left" />
        {(data as { label?: string }).label}
        <NodeToolbar>
          <button className="tb-btn">Delete</button>
        </NodeToolbar>
        <NodeResizer />
        <Handle kind="source" side="right" />
      </div>
    );
  }

  it('toolbar and resizer appear only when the node is selected', () => {
    let api: ReflowApi | null = null;
    const { container } = render(
      <ReFlow
        defaultNodes={[{ id: 'x', type: 'tb', position: { x: 0, y: 0 }, data: { label: 'X' }, width: 120, height: 60 }]}
        nodeTypes={{ tb: ToolbarNode }}
        fitViewOnInit={false}
        onInit={(a) => (api = a)}
      />
    );
    // Not selected yet.
    expect(container.querySelector('.rf-node-toolbar')).toBeNull();
    expect(container.querySelector('.rf-resizer-handle')).toBeNull();
    act(() => api!.setSelection(['x']));
    expect(container.querySelector('.rf-node-toolbar')).not.toBeNull();
    expect(container.querySelectorAll('.rf-resizer-handle').length).toBe(8);
    expect(container.querySelector('.tb-btn')).not.toBeNull();
  });
});

describe('useReflow clipboard API', () => {
  function Probe() {
    const flow = useReflow();
    (globalThis as Record<string, unknown>).__flow = flow;
    return null;
  }
  it('duplicate via API adds cloned nodes', () => {
    let api: ReflowApi | null = null;
    render(
      <ReFlow
        defaultNodes={nodes}
        defaultEdges={[{ id: 'e1', source: 'a', target: 'b' }]}
        fitViewOnInit={false}
        onInit={(a) => (api = a)}
      >
        <Probe />
      </ReFlow>
    );
    act(() => {
      api!.store.setSelection(['a', 'b']);
      api!.store.duplicateSelection();
    });
    expect(api!.getNodes()).toHaveLength(5);
  });
});
