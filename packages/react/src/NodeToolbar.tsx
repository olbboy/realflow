import { memo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Side } from '@realflow/core';
import { useFlowStore, useNodeId } from './context';
import { useFlowSelector, useViewport } from './hooks';

export interface NodeToolbarProps {
  /** Node to attach to. Defaults to the enclosing node. */
  nodeId?: string;
  /** Which side of the node to float on. Default 'top'. */
  position?: Side;
  /** Only show while the node is selected. Default true. */
  isVisible?: boolean;
  /** Gap between node and toolbar, in screen px. Default 8. */
  offset?: number;
  align?: 'start' | 'center' | 'end';
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * A floating toolbar anchored to a node. Rendered inside the node but
 * counter-scaled by 1/zoom so it stays a constant, readable size at any zoom
 * level. Shows on selection by default — perfect for per-node actions.
 */
export const NodeToolbar = memo(function NodeToolbar({
  nodeId,
  position = 'top',
  isVisible,
  offset = 8,
  align = 'center',
  className,
  style,
  children,
}: NodeToolbarProps) {
  const store = useFlowStore();
  const ctxId = useNodeId();
  const id = nodeId ?? ctxId;
  const { zoom } = useViewport(); // re-render on zoom to keep counter-scale exact
  const node = useFlowSelector([`node:${id}`], () => store.nodes.get(id));
  if (!node || node.hidden) return null;

  const show = isVisible ?? !!node.selected;
  if (!show) return null;

  const size = store.nodeSize(id);
  const gap = offset / zoom; // screen px → local units
  const inv = 1 / zoom;

  // Anchor point in node-local coords + which corner of the toolbar pins to it.
  let left = 0;
  let top = 0;
  let tx = '0';
  let ty = '0';
  if (position === 'top' || position === 'bottom') {
    left = align === 'start' ? 0 : align === 'end' ? size.width : size.width / 2;
    tx = align === 'start' ? '0' : align === 'end' ? '-100%' : '-50%';
    if (position === 'top') {
      top = -gap;
      ty = '-100%';
    } else {
      top = size.height + gap;
      ty = '0';
    }
  } else {
    top = size.height / 2;
    ty = '-50%';
    if (position === 'left') {
      left = -gap;
      tx = '-100%';
    } else {
      left = size.width + gap;
      tx = '0';
    }
  }

  return (
    <div
      className={`rf-node-toolbar${className ? ` ${className}` : ''}`}
      style={{
        position: 'absolute',
        left,
        top,
        // Counter-scale so the toolbar is screen-constant size, then pin the
        // correct corner to the anchor.
        transform: `scale(${inv}) translate(${tx}, ${ty})`,
        transformOrigin: `${tx === '-100%' ? '100%' : tx === '-50%' ? '50%' : '0'} ${
          ty === '-100%' ? '100%' : ty === '-50%' ? '50%' : '0'
        }`,
        zIndex: 20,
        ...style,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
});
