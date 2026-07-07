import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  NodeToolbar,
  Panel,
  ReFlow,
  useReflow,
  type Edge,
  type Node,
  type NodeProps,
} from '@reflow/react';

/**
 * Proves ReFlow coexists with portal-based UI-framework primitives
 * (Radix / Base UI / shadcn dropdowns, popovers, dialogs). The menu below
 * uses the exact pattern those libraries use: React portal to document.body
 * + fixed positioning + its own pointer handling. The node stays draggable,
 * the menu opens above everything, and clicking it never pans the canvas.
 */

/** A portal dropdown, mimicking Radix/Base UI DropdownMenu. */
function PortalMenu({
  anchorRef,
  open,
  onClose,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 6 });
    // Close on outside interaction only — ignore clicks inside the menu or
    // on the trigger (the exact Radix/Base UI dismiss pattern).
    const close = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (menuRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    window.addEventListener('pointerdown', close, { capture: true });
    return () => window.removeEventListener('pointerdown', close, { capture: true });
  }, [open, anchorRef, onClose]);
  if (!open || !pos) return null;
  return createPortal(
    <div
      ref={menuRef}
      className="fw-menu"
      style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 9999 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

/** A shadcn-style Card node with a portal dropdown + inline input. */
function ServiceNode({ id, data }: NodeProps) {
  const flow = useReflow();
  const d = data as { label?: string; env?: string; replicas?: number };
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="fw-card">
      <Handle kind="target" side="left" />
      <NodeToolbar position="top">
        <button className="fw-tbtn" onClick={() => flow.store.duplicateSelection()}>
          Duplicate
        </button>
        <button className="fw-tbtn fw-danger" onClick={() => flow.removeNodes([id])}>
          Delete
        </button>
      </NodeToolbar>
      <div className="fw-card-head">
        <span className="fw-dot" />
        <span className="fw-card-title">{d.label}</span>
        <button
          ref={btnRef}
          className="fw-menu-btn rf-nodrag"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          ⋯
        </button>
      </div>
      <label className="fw-field">
        <span>env</span>
        <select
          className="rf-nodrag"
          value={d.env}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => flow.updateNodeData(id, { env: e.target.value })}
        >
          <option>production</option>
          <option>staging</option>
          <option>dev</option>
        </select>
      </label>
      <label className="fw-field">
        <span>replicas</span>
        <input
          className="rf-nodrag"
          type="number"
          min={1}
          value={d.replicas ?? 1}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => flow.updateNodeData(id, { replicas: Number(e.target.value) })}
        />
      </label>
      <Handle kind="source" side="right" />
      <PortalMenu anchorRef={btnRef} open={menuOpen} onClose={() => setMenuOpen(false)}>
        <button className="fw-mitem" onClick={() => { flow.updateNodeData(id, { replicas: (d.replicas ?? 1) + 1 }); setMenuOpen(false); }}>
          Scale up
        </button>
        <button className="fw-mitem" onClick={() => { flow.store.setSelection([id]); setMenuOpen(false); }}>
          Select
        </button>
        <button className="fw-mitem fw-danger" onClick={() => flow.removeNodes([id])}>
          Delete
        </button>
      </PortalMenu>
    </div>
  );
}

const fwNodeTypes = { service: ServiceNode };

const fwNodes: Node[] = [
  { id: 'api', type: 'service', position: { x: 0, y: 40 }, data: { label: 'API gateway', env: 'production', replicas: 3 } },
  { id: 'auth', type: 'service', position: { x: 320, y: -40 }, data: { label: 'Auth service', env: 'production', replicas: 2 } },
  { id: 'db', type: 'service', position: { x: 320, y: 160 }, data: { label: 'Database', env: 'production', replicas: 1 } },
];
const fwEdges: Edge[] = [
  { id: 'e1', source: 'api', target: 'auth', markerEnd: { type: 'arrowclosed' } },
  { id: 'e2', source: 'api', target: 'db', markerEnd: { type: 'arrowclosed' } },
];

export function FrameworkScene({ dark }: { dark: boolean }) {
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
        portal dropdowns · &lt;select&gt; · number inputs — all live inside draggable nodes, no pointer/z-index conflict
      </Panel>
    </ReFlow>
  );
}
