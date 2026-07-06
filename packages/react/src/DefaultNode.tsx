import { memo } from 'react';
import type { NodeProps } from './types';
import { Handle } from './Handle';

/**
 * The built-in node: label + optional description, target handle on the
 * left, source handle on the right. Beautiful out of the box.
 */
export const DefaultNode = memo(function DefaultNode({ data }: NodeProps) {
  const label = (data as { label?: string }).label ?? '';
  const description = (data as { description?: string }).description;
  const icon = (data as { icon?: string }).icon;
  const accent = (data as { accent?: string }).accent;
  return (
    <div className="rf-default-node" style={accent ? { ['--rf-node-accent' as string]: accent } : undefined}>
      <Handle kind="target" side="left" />
      {icon ? <span className="rf-default-node-icon">{icon}</span> : null}
      <div className="rf-default-node-body">
        <div className="rf-default-node-label">{label}</div>
        {description ? <div className="rf-default-node-desc">{description}</div> : null}
      </div>
      <Handle kind="source" side="right" />
    </div>
  );
});

/** Entry node: only a source handle. */
export const InputNode = memo(function InputNode({ data }: NodeProps) {
  const label = (data as { label?: string }).label ?? '';
  return (
    <div className="rf-default-node rf-input-node">
      <div className="rf-default-node-body">
        <div className="rf-default-node-label">{label}</div>
      </div>
      <Handle kind="source" side="right" />
    </div>
  );
});

/** Terminal node: only a target handle. */
export const OutputNode = memo(function OutputNode({ data }: NodeProps) {
  const label = (data as { label?: string }).label ?? '';
  return (
    <div className="rf-default-node rf-output-node">
      <Handle kind="target" side="left" />
      <div className="rf-default-node-body">
        <div className="rf-default-node-label">{label}</div>
      </div>
    </div>
  );
});

/** Group node: a labeled container for child nodes (parentId). */
export const GroupNode = memo(function GroupNode({ data }: NodeProps) {
  const label = (data as { label?: string }).label;
  return <div className="rf-group-node">{label ? <div className="rf-group-node-label">{label}</div> : null}</div>;
});
