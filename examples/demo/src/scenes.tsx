import type { Edge, Node } from '@realflow/react';
import { Handle, type NodeProps } from '@realflow/react';

/* ── custom node types ─────────────────────────────────────────────── */

export function TriggerNode({ data }: NodeProps) {
  const d = data as { label?: string; event?: string };
  return (
    <div className="demo-node demo-trigger">
      <div className="demo-node-head">
        <span className="demo-node-emoji">⚡</span>
        <span>{d.label}</span>
      </div>
      <div className="demo-node-sub">{d.event}</div>
      <Handle kind="source" side="right" dataType="event" />
    </div>
  );
}

export function ActionNode({ data }: NodeProps) {
  const d = data as { label?: string; detail?: string; status?: string };
  return (
    <div className="demo-node demo-action">
      <Handle kind="target" side="left" dataType="event" />
      <div className="demo-node-head">
        <span className="demo-node-emoji">🛠️</span>
        <span>{d.label}</span>
      </div>
      <div className="demo-node-sub">{d.detail}</div>
      {d.status ? <span className={`demo-pill demo-pill-${d.status}`}>{d.status}</span> : null}
      <Handle kind="source" side="right" dataType="event" />
    </div>
  );
}

export function ConditionNode({ data }: NodeProps) {
  const d = data as { label?: string };
  return (
    <div className="demo-node demo-condition">
      <Handle kind="target" side="left" dataType="event" />
      <div className="demo-node-head">
        <span className="demo-node-emoji">🔀</span>
        <span>{d.label}</span>
      </div>
      <div className="demo-branch">
        <div className="demo-branch-row">
          <span>true</span>
          <Handle kind="source" side="right" id="true" dataType="event" className="demo-handle-inline" />
        </div>
        <div className="demo-branch-row">
          <span>false</span>
          <Handle kind="source" side="right" id="false" dataType="event" className="demo-handle-inline" />
        </div>
      </div>
    </div>
  );
}

export const demoNodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
};

/* ── showcase scene ────────────────────────────────────────────────── */

export const showcaseNodes: Node[] = [
  {
    id: 'trigger',
    type: 'trigger',
    position: { x: 0, y: 160 },
    data: { label: 'Webhook', event: 'order.created' },
  },
  {
    id: 'enrich',
    type: 'action',
    position: { x: 260, y: 60 },
    data: { label: 'Enrich order', detail: 'lookup customer', status: 'ok' },
  },
  {
    id: 'fraud',
    type: 'condition',
    position: { x: 260, y: 240 },
    data: { label: 'Fraud check' },
  },
  {
    id: 'group-fulfil',
    type: 'group',
    position: { x: 560, y: 20 },
    width: 460,
    height: 240,
    data: { label: 'Fulfilment' },
  },
  {
    id: 'reserve',
    type: 'action',
    parentId: 'group-fulfil',
    position: { x: 30, y: 50 },
    data: { label: 'Reserve stock', detail: 'warehouse A', status: 'ok' },
  },
  {
    id: 'ship',
    type: 'action',
    parentId: 'group-fulfil',
    position: { x: 250, y: 120 },
    data: { label: 'Create shipment', detail: 'carrier: DHL', status: 'run' },
  },
  {
    id: 'review',
    type: 'action',
    position: { x: 620, y: 330 },
    data: { label: 'Manual review', detail: 'assign to ops', status: 'wait' },
  },
  {
    id: 'notify',
    type: 'action',
    position: { x: 1100, y: 180 },
    data: { label: 'Notify customer', detail: 'email + sms' },
  },
];

export const showcaseEdges: Edge[] = [
  { id: 'e1', source: 'trigger', target: 'enrich', animated: true, markerEnd: { type: 'arrowclosed' } },
  { id: 'e2', source: 'trigger', target: 'fraud', animated: true, markerEnd: { type: 'arrowclosed' } },
  { id: 'e3', source: 'enrich', target: 'reserve', type: 'smoothstep', markerEnd: { type: 'arrowclosed' } },
  { id: 'e4', source: 'fraud', sourceHandle: 'true', target: 'reserve', type: 'smoothstep', label: 'pass', markerEnd: { type: 'arrowclosed' } },
  { id: 'e5', source: 'fraud', sourceHandle: 'false', target: 'review', type: 'smoothstep', label: 'flag', markerEnd: { type: 'arrowclosed' } },
  { id: 'e6', source: 'reserve', target: 'ship', markerEnd: { type: 'arrowclosed' } },
  { id: 'e7', source: 'ship', target: 'notify', animated: true, markerEnd: { type: 'arrowclosed' } },
  { id: 'e8', source: 'review', target: 'notify', type: 'smoothstep', markerEnd: { type: 'arrowclosed' } },
];

/* ── stress scene ──────────────────────────────────────────────────── */

export const makeStress = (count: number): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const cols = Math.ceil(Math.sqrt(count) * 1.4);
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `n${i}`,
      position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 110 },
      data: { label: `Node ${i}`, description: `#${i}` },
      width: 172,
      height: 58,
    });
    if (i > 0) {
      edges.push({
        id: `e${i}`,
        source: `n${Math.floor((i - 1) / 2)}`,
        target: `n${i}`,
        type: 'smoothstep',
      });
    }
  }
  return { nodes, edges };
};
