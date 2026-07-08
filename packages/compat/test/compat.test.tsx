// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  reconnectEdge,
  type Node,
  type Edge,
  type Connection,
} from '@realflow/compat';

afterEach(cleanup);

// A realistic React Flow-style app, verbatim to how RF docs show it.
const initialNodes: Node[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Input' }, type: 'input' },
  { id: '2', position: { x: 200, y: 100 }, data: { label: 'Default' } },
];
const initialEdges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }];

describe('@realflow/compat — React Flow API surface', () => {
  it('Position/MarkerType enums match React Flow values', () => {
    expect(Position.Left).toBe('left');
    expect(Position.Right).toBe('right');
    expect(Position.Top).toBe('top');
    expect(Position.Bottom).toBe('bottom');
    expect(MarkerType.ArrowClosed).toBe('arrowclosed');
  });

  it('applyNodeChanges applies position/select/remove/add like React Flow', () => {
    let nodes = initialNodes;
    nodes = applyNodeChanges([{ type: 'position', id: '1', position: { x: 50, y: 60 } }], nodes);
    expect(nodes.find((n) => n.id === '1')!.position).toEqual({ x: 50, y: 60 });
    nodes = applyNodeChanges([{ type: 'select', id: '2', selected: true }], nodes);
    expect(nodes.find((n) => n.id === '2')!.selected).toBe(true);
    nodes = applyNodeChanges([{ type: 'remove', id: '1' }], nodes);
    expect(nodes.map((n) => n.id)).toEqual(['2']);
    nodes = applyNodeChanges(
      [{ type: 'add', item: { id: '3', position: { x: 0, y: 0 }, data: {} } }],
      nodes
    );
    expect(nodes.map((n) => n.id)).toEqual(['2', '3']);
  });

  it('addEdge dedups and assigns a React Flow-style id', () => {
    const conn: Connection = { source: '1', target: '2', sourceHandle: null, targetHandle: null };
    let edges: Edge[] = [];
    edges = addEdge(conn, edges);
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toContain('reactflow__edge');
    edges = addEdge(conn, edges); // duplicate
    expect(edges).toHaveLength(1);
  });

  it('reconnectEdge moves an endpoint', () => {
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];
    const out = reconnectEdge(edges[0], { source: 'a', target: 'c', sourceHandle: null, targetHandle: null }, edges);
    expect(out[0].target).toBe('c');
  });

  it('applyEdgeChanges select/remove', () => {
    let edges = initialEdges;
    edges = applyEdgeChanges([{ type: 'select', id: 'e1-2', selected: true }], edges);
    expect(edges[0].selected).toBe(true);
    edges = applyEdgeChanges([{ type: 'remove', id: 'e1-2' }], edges);
    expect(edges).toHaveLength(0);
  });

  it('renders a controlled React Flow app (nodes/edges + hooks)', () => {
    function App() {
      const [nodes, , onNodesChange] = useNodesState(initialNodes);
      const [edges, , onEdgesChange] = useEdgesState(initialEdges);
      return (
        <div style={{ width: 800, height: 600 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView={false}
          />
        </div>
      );
    }
    const { container } = render(<App />);
    expect(container.querySelectorAll('.rf-node')).toHaveLength(2);
    expect(container.querySelectorAll('.rf-edge')).toHaveLength(1);
    expect(screen.getByText('Input')).toBeTruthy();
  });

  it('custom node with React Flow Handle (type/position) renders and connects', () => {
    const onConnect = vi.fn();
    function CustomNode({ data }: { data: { label: string } }) {
      return (
        <div className="custom">
          <Handle type="target" position={Position.Left} />
          {data.label}
          <Handle type="source" position={Position.Right} />
        </div>
      );
    }
    function App() {
      const [nodes, , onNodesChange] = useNodesState([
        { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' }, type: 'custom' },
        { id: 'b', position: { x: 300, y: 0 }, data: { label: 'B' }, type: 'custom' },
      ]);
      return (
        <ReactFlow
          nodes={nodes}
          onNodesChange={onNodesChange}
          nodeTypes={{ custom: CustomNode }}
          onConnect={onConnect}
          fitView={false}
        />
      );
    }
    const { container } = render(<App />);
    expect(container.querySelectorAll('.custom')).toHaveLength(2);
    // Two handles per node.
    expect(container.querySelectorAll('.rf-handle').length).toBeGreaterThanOrEqual(4);
  });

  it('onNodesChange fires React Flow change objects for real mutations (add/remove)', async () => {
    // Interactions that go through the engine's commit pipeline (add, delete,
    // drag) surface as change objects — exactly like React Flow. Imperative
    // setNodes is a separate escape hatch (also matching React Flow).
    const changesSeen: any[] = [];
    let instanceRef: any = null;
    function App() {
      const [nodes, setNodes] = useState(initialNodes);
      return (
        <ReactFlow
          nodes={nodes}
          onNodesChange={(changes) => {
            changesSeen.push(...changes);
            setNodes((nds) => applyNodeChanges(changes, nds));
          }}
          fitView={false}
          onInit={(instance) => {
            instanceRef = instance;
          }}
        />
      );
    }
    render(<App />);
    await act(async () => {
      instanceRef.addNodes({ id: '99', position: { x: 500, y: 500 }, data: { label: 'New' } });
      await new Promise((r) => setTimeout(r, 20));
    });
    const addChange = changesSeen.find((c) => c.type === 'add' && c.item?.id === '99');
    expect(addChange).toBeTruthy();

    await act(async () => {
      instanceRef.deleteElements({ nodes: [{ id: '1' }] });
      await new Promise((r) => setTimeout(r, 20));
    });
    const removeChange = changesSeen.find((c) => c.type === 'remove' && c.id === '1');
    expect(removeChange).toBeTruthy();
  });

  it('useReactFlow exposes screenToFlowPosition, fitView, setNodes, toObject', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ReactFlowProvider>
        <ReactFlow defaultNodes={initialNodes} defaultEdges={initialEdges} fitView={false} />
        {children}
      </ReactFlowProvider>
    );
    const { result } = renderHook(() => useReactFlow(), { wrapper });
    expect(typeof result.current.screenToFlowPosition).toBe('function');
    const p = result.current.screenToFlowPosition({ x: 100, y: 100 });
    expect(p).toHaveProperty('x');
    expect(typeof result.current.fitView).toBe('function');
    const obj = result.current.toObject();
    expect(obj).toHaveProperty('nodes');
    expect(obj).toHaveProperty('viewport');
  });
});
