import { memo } from 'react';
import type { NodeProps } from './types';
import { splinePath, type XY } from '@realflow/core';
import { NodeResizer } from './NodeResizer';

/** Rectangle / ellipse / diamond shape node, drawn on the canvas and resizable. */
export const ShapeNode = memo(function ShapeNode({ data, node }: NodeProps) {
  const shape = (data as { shape?: string }).shape ?? 'rectangle';
  const fill = (data as { fill?: string }).fill ?? 'var(--rf-shape-fill)';
  const stroke = (data as { stroke?: string }).stroke ?? 'var(--rf-accent)';
  const w = node.width ?? 120;
  const h = node.height ?? 80;
  return (
    <div className="rf-shape-node">
      <NodeResizer minWidth={8} minHeight={8} />
      <svg className="rf-shape-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {shape === 'ellipse' ? (
          <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - 1)} ry={Math.max(0, h / 2 - 1)} fill={fill} stroke={stroke} strokeWidth={2} />
        ) : shape === 'diamond' ? (
          <polygon points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`} fill={fill} stroke={stroke} strokeWidth={2} />
        ) : (
          <rect x={1} y={1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} rx={6} fill={fill} stroke={stroke} strokeWidth={2} />
        )}
      </svg>
    </div>
  );
});

/** Freehand stroke node — a smooth spline through the captured points. */
export const FreehandNode = memo(function FreehandNode({ data, node }: NodeProps) {
  const points = (data as { points?: XY[] }).points ?? [];
  const stroke = (data as { stroke?: string }).stroke ?? 'var(--rf-accent)';
  const w = node.width ?? 1;
  const h = node.height ?? 1;
  const d = points.length > 1 ? splinePath(points).d : '';
  return (
    <div className="rf-freehand-node">
      <NodeResizer minWidth={8} minHeight={8} />
      <svg className="rf-freehand-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
});
