import { useEffect, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  RealFlow,
  toSvg,
  uid,
  type LayoutType,
  type RealFlowApi,
  type Tool,
} from '@realflow/react';
import { demoNodeTypes, makeStress, showcaseEdges, showcaseNodes } from './scenes';
import { AIScene } from './AIScene';
import { FrameworkScene } from './FrameworkScene';
import { RoutingScene } from './RoutingScene';

type Scene = 'showcase' | 'copilot' | 'framework' | 'routing' | 'stress-1k' | 'stress-5k' | 'stress-10k';

const sceneData = (scene: Scene) => {
  switch (scene) {
    case 'showcase':
    case 'copilot':
    case 'framework':
    case 'routing':
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
  const apiRef = useRef<RealFlowApi | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const { nodes, edges } = sceneData(scene);
  const isShowcase = scene === 'showcase';

  const runLayout = (type: LayoutType): void => {
    apiRef.current?.layout(type, { duration: 350 });
  };

  const pickTool = (t: Tool): void => {
    apiRef.current?.setTool(tool === t ? 'select' : t);
  };

  const exportSvg = (): void => {
    const api = apiRef.current;
    if (!api) return;
    const blob = new Blob([toSvg(api.store)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'realflow.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupSelection = (): void => {
    apiRef.current?.groupSelection({ label: 'Group' });
  };

  const collapseSelection = (): void => {
    const api = apiRef.current;
    if (!api) return;
    const first = [...api.store.selectedNodes][0];
    if (first) api.toggleCollapse(first);
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
          <span className="demo-logo">◆</span> RealFlow
          <span className="demo-tagline">node-based UIs for React, reimagined</span>
        </div>
        <nav className="demo-tabs">
          {(
            [
              ['showcase', 'Showcase'],
              ['copilot', 'AI copilot'],
              ['framework', 'UI frameworks'],
              ['routing', 'Smart routing'],
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
        ) : scene === 'framework' ? (
          <FrameworkScene key="framework" dark={dark} />
        ) : scene === 'routing' ? (
          <RoutingScene key="routing" dark={dark} />
        ) : (
        <RealFlow
          key={scene}
          defaultNodes={nodes}
          defaultEdges={edges}
          nodeTypes={demoNodeTypes}
          colorMode={dark ? 'dark' : 'light'}
          defaultEdgeOptions={{ type: 'bezier', markerEnd: { type: 'arrowclosed' } }}
          preventCycles={isShowcase}
          reparentOnDrop={isShowcase}
          snapGrid={0}
          onInit={(api) => {
            apiRef.current = api;
            setTool(api.store.tool);
            api.store.subscribe('tool', () => setTool(api.store.tool));
          }}
          fitViewOptions={isShowcase ? { maxZoom: 1.1 } : { minZoom: 0.55, maxZoom: 1 }}
        >
          <Background variant="dots" />
          <Controls />
          <MiniMap />
          <Panel position="top-right" className="demo-toolbar">
            {isShowcase ? (
              <>
                <button onClick={addNode}>+ Node</button>
                <button onClick={groupSelection} title="Group the selected nodes (shift-drag to select)">⧉ Group</button>
                <button onClick={collapseSelection} title="Collapse/expand the selected node's subtree">⊟ Collapse</button>
                <span className="demo-toolbar-label">draw</span>
                <button className={tool === 'rectangle' ? 'active' : ''} onClick={() => pickTool('rectangle')} title="Draw a rectangle">▭</button>
                <button className={tool === 'ellipse' ? 'active' : ''} onClick={() => pickTool('ellipse')} title="Draw an ellipse">⬭</button>
                <button className={tool === 'diamond' ? 'active' : ''} onClick={() => pickTool('diamond')} title="Draw a diamond">◇</button>
                <button className={tool === 'freehand' ? 'active' : ''} onClick={() => pickTool('freehand')} title="Freehand draw">✎</button>
              </>
            ) : null}
            <span className="demo-toolbar-label">layout</span>
            <button onClick={() => runLayout('layered')}>layered</button>
            <button onClick={() => runLayout('tree')}>tree</button>
            <button onClick={() => runLayout('force')}>force</button>
            <button onClick={() => runLayout('radial')}>radial</button>
            <button onClick={() => runLayout('grid')}>grid</button>
            <span className="demo-toolbar-label">export</span>
            <button onClick={exportSvg} title="Download the flow as SVG">⤓ SVG</button>
          </Panel>
          <Panel position="bottom-center" className="demo-hint">
            drag from a handle to connect · double-click an edge to bend it · shift-drag to box-select · ⌘Z undo · scroll to zoom
          </Panel>
          <FpsMeter />
        </RealFlow>
        )}
      </main>
    </div>
  );
}
