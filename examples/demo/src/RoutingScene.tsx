import { useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  RealFlow,
  type Edge,
  type Node,
} from '@realflow/react';

/**
 * Orthogonal edges route AROUND nodes — drag the obstacle nodes and watch
 * the edges re-route live. Neither React Flow nor stock RealFlow did this.
 */

const nodes: Node[] = [
  { id: 'src', position: { x: 0, y: 200 }, data: { label: 'Source' }, width: 120, height: 48 },
  { id: 'dst', position: { x: 640, y: 200 }, data: { label: 'Target' }, width: 120, height: 48 },
  // These sit squarely on the straight line src→dst, forcing a detour.
  { id: 'o1', position: { x: 250, y: 175 }, data: { label: 'obstacle', description: 'drag me' }, width: 110, height: 90 },
  { id: 'o2', position: { x: 430, y: 175 }, data: { label: 'obstacle', description: 'drag me' }, width: 110, height: 90 },
  { id: 'a', position: { x: 0, y: 20 }, data: { label: 'A' }, width: 100, height: 44 },
  { id: 'b', position: { x: 640, y: 400 }, data: { label: 'B' }, width: 100, height: 44 },
];

const edges: Edge[] = [
  { id: 'e1', source: 'src', target: 'dst', type: 'orthogonal', markerEnd: { type: 'arrowclosed' }, label: 'routed' },
  { id: 'e2', source: 'a', target: 'b', type: 'orthogonal', markerEnd: { type: 'arrowclosed' } },
];

export function RoutingScene({ dark }: { dark: boolean }) {
  const [mode, setMode] = useState<'orthogonal' | 'bezier'>('orthogonal');
  return (
    <RealFlow
      key={mode}
      defaultNodes={nodes}
      defaultEdges={edges.map((e) => ({ ...e, type: mode }))}
      colorMode={dark ? 'dark' : 'light'}
      fitViewOptions={{ maxZoom: 1.1 }}
    >
      <Background variant="dots" />
      <Controls />
      <MiniMap />
      <Panel position="top-right" className="demo-toolbar">
        <span className="demo-toolbar-label">edge type</span>
        <button className={mode === 'orthogonal' ? 'active' : ''} onClick={() => setMode('orthogonal')}>
          orthogonal (avoids)
        </button>
        <button className={mode === 'bezier' ? 'active' : ''} onClick={() => setMode('bezier')}>
          bezier (crosses)
        </button>
      </Panel>
      <Panel position="bottom-center" className="demo-hint">
        drag the obstacle nodes — orthogonal edges re-route around them in real time
      </Panel>
    </RealFlow>
  );
}
