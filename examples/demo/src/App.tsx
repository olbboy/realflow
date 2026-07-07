import { useEffect, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReFlow,
  uid,
  type LayoutType,
  type ReflowApi,
} from '@reflow/react';
import { demoNodeTypes, makeStress, showcaseEdges, showcaseNodes } from './scenes';
import { AIScene } from './AIScene';

type Scene = 'showcase' | 'copilot' | 'stress-1k' | 'stress-5k' | 'stress-10k';

const sceneData = (scene: Scene) => {
  switch (scene) {
    case 'showcase':
    case 'copilot':
      return { nodes: showcaseNodes, edges: showcaseEdges };
    case 'stress-1k':
      return makeStress(1000);
    case 'stress-5k':
      return makeStress(5000);
    case 'stress-10k':
      return makeStress(10000);
  }
};

function FpsMeter() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (): void => {
      frames++;
      const now = performance.now();
      if (now - last >= 500) {
        const fps = Math.round((frames * 1000) / (now - last));
        if (ref.current) {
          ref.current.textContent = String(fps);
          ref.current.dataset.level = fps >= 50 ? 'good' : fps >= 30 ? 'ok' : 'bad';
        }
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="demo-fps">
      <span ref={ref}>60</span> fps
    </div>
  );
}

export default function App() {
  const [scene, setScene] = useState<Scene>('showcase');
  const [dark, setDark] = useState(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );
  const apiRef = useRef<ReflowApi | null>(null);
  const { nodes, edges } = sceneData(scene);
  const isShowcase = scene === 'showcase';

  const runLayout = (type: LayoutType): void => {
    apiRef.current?.layout(type, { duration: 350 });
  };

  const addNode = (): void => {
    const api = apiRef.current;
    if (!api) return;
    const center = api.screenToFlow({
      x: api.store.screen.width / 2,
      y: api.store.screen.height / 2,
    });
    api.addNode({
      id: uid('node'),
      type: 'action',
      position: { x: center.x - 90 + (Math.random() - 0.5) * 120, y: center.y - 30 + (Math.random() - 0.5) * 120 },
      data: { label: 'New step', detail: 'double-click to inspect' },
    });
  };

  return (
    <div className={`demo-app${dark ? ' demo-dark' : ''}`}>
      <header className="demo-header">
        <div className="demo-brand">
          <span className="demo-logo">◆</span> ReFlow
          <span className="demo-tagline">node-based UIs for React, reimagined</span>
        </div>
        <nav className="demo-tabs">
          {(
            [
              ['showcase', 'Showcase'],
              ['copilot', 'AI copilot'],
              ['stress-1k', '1k nodes'],
              ['stress-5k', '5k nodes'],
              ['stress-10k', '10k nodes'],
            ] as [Scene, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={scene === key ? 'active' : ''}
              onClick={() => setScene(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="demo-actions">
          <button onClick={() => setDark((d) => !d)} title="Toggle color mode">
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>
      <main className="demo-canvas">
        {scene === 'copilot' ? (
          <AIScene key="copilot" dark={dark} />
        ) : (
        <ReFlow
          key={scene}
          defaultNodes={nodes}
          defaultEdges={edges}
          nodeTypes={demoNodeTypes}
          colorMode={dark ? 'dark' : 'light'}
          defaultEdgeOptions={{ type: 'bezier', markerEnd: { type: 'arrowclosed' } }}
          preventCycles={isShowcase}
          snapGrid={0}
          onInit={(api) => {
            apiRef.current = api;
          }}
          fitViewOptions={isShowcase ? { maxZoom: 1.1 } : { minZoom: 0.55, maxZoom: 1 }}
        >
          <Background variant="dots" />
          <Controls />
          <MiniMap />
          <Panel position="top-right" className="demo-toolbar">
            {isShowcase ? (
              <button onClick={addNode}>+ Node</button>
            ) : null}
            <span className="demo-toolbar-label">layout</span>
            <button onClick={() => runLayout('layered')}>layered</button>
            <button onClick={() => runLayout('tree')}>tree</button>
            <button onClick={() => runLayout('force')}>force</button>
            <button onClick={() => runLayout('radial')}>radial</button>
            <button onClick={() => runLayout('grid')}>grid</button>
          </Panel>
          <Panel position="bottom-center" className="demo-hint">
            drag from a handle to connect · shift-drag to box-select · ⌘Z undo · scroll to zoom
          </Panel>
          <FpsMeter />
        </ReFlow>
        )}
      </main>
    </div>
  );
}
