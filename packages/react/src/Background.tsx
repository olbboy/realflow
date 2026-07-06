import { memo, useId } from 'react';
import { useViewport } from './hooks';

export interface BackgroundProps {
  variant?: 'dots' | 'lines' | 'cross';
  /** Grid spacing in flow px. */
  gap?: number;
  /** Dot radius / line thickness. */
  size?: number;
  className?: string;
}

/** The canvas background pattern, kept in sync with pan/zoom. */
export const Background = memo(function Background({
  variant = 'dots',
  gap = 24,
  size,
  className,
}: BackgroundProps) {
  const { x, y, zoom } = useViewport();
  const patternId = useId();
  const scaledGap = gap * zoom;
  const offsetX = x % scaledGap;
  const offsetY = y % scaledGap;

  let content: React.ReactNode;
  if (variant === 'dots') {
    const r = (size ?? 1) * zoom;
    content = <circle cx={scaledGap / 2} cy={scaledGap / 2} r={Math.max(r, 0.4)} className="rf-bg-dot" />;
  } else if (variant === 'lines') {
    const w = size ?? 1;
    content = (
      <path
        d={`M ${scaledGap} 0 V ${scaledGap} M 0 ${scaledGap} H ${scaledGap}`}
        strokeWidth={w}
        className="rf-bg-line"
        fill="none"
      />
    );
  } else {
    const l = (size ?? 6) * zoom;
    const c = scaledGap / 2;
    content = (
      <path
        d={`M ${c - l / 2} ${c} H ${c + l / 2} M ${c} ${c - l / 2} V ${c + l / 2}`}
        strokeWidth={zoom}
        className="rf-bg-cross"
        fill="none"
      />
    );
  }

  return (
    <svg className={`rf-background${className ? ` ${className}` : ''}`} aria-hidden="true">
      <pattern
        id={patternId}
        x={offsetX}
        y={offsetY}
        width={scaledGap}
        height={scaledGap}
        patternUnits="userSpaceOnUse"
      >
        {content}
      </pattern>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
});
