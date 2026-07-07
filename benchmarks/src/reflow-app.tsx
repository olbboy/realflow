import { createRoot } from 'react-dom/client';
import { ReFlow, Background, type Node, type Edge } from '@reflow/react';
import '@reflow/react/styles.css';
import { makeScene, sceneSizeFromUrl } from './scene';

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
    <ReFlow
      defaultNodes={nodes}
      defaultEdges={edges}
      minZoom={0.02}
      onInit={(api) => {
        // Expose a "zoom to editing level" for the realistic benchmark
        // scenario: zoom=1 centered on the middle node so only a
        // viewport-worth of nodes is visible (culling can help here).
        (window as unknown as { __zoomEdit: () => void }).__zoomEdit = () => {
          const mid = nodes[Math.floor(nodes.length / 2)];
          api.setViewport({
            x: window.innerWidth / 2 - (mid.position.x + 80),
            y: window.innerHeight / 2 - (mid.position.y + 24),
            zoom: 1,
          });
        };
      }}
    >
      <Background />
    </ReFlow>
  </div>
);
