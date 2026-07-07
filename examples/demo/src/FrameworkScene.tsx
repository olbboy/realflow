import { useEffect } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReFlow,
  type Edge,
  type Node,
} from '@reflow/react';
import { ShadcnServiceNode } from './nodes/ShadcnServiceNode';
import { BaseUiServiceNode } from './nodes/BaseUiServiceNode';
import './shadcn.css';

/**
 * Gate B proof: real UI-framework components living inside ReFlow nodes.
 *  - `shadcn` nodes are built from shadcn/ui Card + Select + Popover, which
 *    are the real @radix-ui/react-select and @radix-ui/react-popover.
 *  - `baseui` nodes are built from real @base-ui-components/react Select +
 *    Popover.
 * Both use portals + fixed positioning; dragging, panning and zooming the
 * canvas never conflicts with their menus, and opening a menu never pans.
 */
const fwNodeTypes = {
  shadcn: ShadcnServiceNode,
  baseui: BaseUiServiceNode,
};

const fwNodes: Node[] = [
  { id: 'svc-api', type: 'shadcn', position: { x: 0, y: 0 }, data: { label: 'API gateway', env: 'production', replicas: 3 } },
  { id: 'svc-auth', type: 'shadcn', position: { x: 340, y: -80 }, data: { label: 'Auth service', env: 'staging', replicas: 2 } },
  { id: 'svc-base', type: 'baseui', position: { x: 340, y: 140 }, data: { label: 'Billing (Base UI)', env: 'production', replicas: 1 } },
];
const fwEdges: Edge[] = [
  { id: 'fw-e1', source: 'svc-api', target: 'svc-auth', markerEnd: { type: 'arrowclosed' } },
  { id: 'fw-e2', source: 'svc-api', target: 'svc-base', markerEnd: { type: 'arrowclosed' } },
];

export function FrameworkScene({ dark }: { dark: boolean }) {
  // shadcn / Base UI theme tokens switch on the `.dark` class. Portaled
  // popovers live on <body>, so the class must sit on <html> to reach them.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    return () => root.classList.remove('dark');
  }, [dark]);

  return (
    <ReFlow
      defaultNodes={fwNodes}
      defaultEdges={fwEdges}
      nodeTypes={fwNodeTypes}
      colorMode={dark ? 'dark' : 'light'}
      fitViewOptions={{ maxZoom: 1 }}
    >
      <Background variant="dots" />
      <Controls />
      <MiniMap />
      <Panel position="bottom-center" className="demo-hint">
        real shadcn/ui (Radix) + Base UI Card · Select · Popover inside draggable nodes —
        portals, positioning and pointer handling all coexist with pan/zoom
      </Panel>
    </ReFlow>
  );
}
