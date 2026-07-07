import { createRoot } from 'react-dom/client';
import { ReactFlow, Background, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { makeScene, sceneSizeFromUrl } from './scene';

const params = new URLSearchParams(location.search);
// ?cull=1 enables React Flow's opt-in culling for a fair "both culling" row.
const onlyVisible = params.get('cull') === '1';

const scene = makeScene(sceneSizeFromUrl());
const nodes: Node[] = scene.nodes.map((n) => ({
  id: n.id,
  position: { x: n.x, y: n.y },
  data: { label: n.label },
  width: 160,
  height: 48,
}));
const edges: Edge[] = scene.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));

(window as unknown as { __RENDER_START: number }).__RENDER_START = performance.now();

createRoot(document.getElementById('root')!).render(
  <div style={{ width: '100vw', height: '100vh' }}>
    <ReactFlow
      defaultNodes={nodes}
      defaultEdges={edges}
      minZoom={0.02}
      onlyRenderVisibleElements={onlyVisible}
      fitView
      onInit={(instance) => {
        const mid = nodes[Math.floor(nodes.length / 2)];
        (window as unknown as { __zoomEdit: () => void }).__zoomEdit = () => {
          instance.setViewport({
            x: window.innerWidth / 2 - (mid.position.x + 80),
            y: window.innerHeight / 2 - (mid.position.y + 24),
            zoom: 1,
          });
        };
      }}
    >
      <Background />
    </ReactFlow>
  </div>
);
