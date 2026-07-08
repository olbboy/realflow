import { RealFlow, Background, Panel, useRealFlow, type LayoutType } from '@realflow/react';

const ids = ['root', 'a', 'b', 'c', 'd', 'e', 'f'];
const nodes = ids.map((id, i) => ({ id, position: { x: (i % 3) * 40, y: i * 20 }, data: { label: id } }));
const edges = [
  ['root', 'a'], ['root', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'e'], ['b', 'f'],
].map(([source, target], i) => ({ id: `e${i}`, source, target, markerEnd: { type: 'arrowclosed' as const } }));

function Toolbar() {
  const flow = useRealFlow();
  const run = (t: LayoutType) => flow.layout(t, { duration: 300 });
  return (
    <Panel position="top-right" style={{ display: 'flex', gap: 6 }}>
      {(['layered', 'tree', 'force', 'radial', 'grid'] as LayoutType[]).map((t) => (
        <button key={t} onClick={() => run(t)}>{t}</button>
      ))}
    </Panel>
  );
}

export function AutoLayout() {
  return (
    <RealFlow defaultNodes={nodes} defaultEdges={edges}>
      <Background />
      <Toolbar />
    </RealFlow>
  );
}
