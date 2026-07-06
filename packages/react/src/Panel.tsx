import { memo } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export type PanelPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface PanelProps {
  position?: PanelPosition;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** Floating overlay container; swallows pointer events so the pane below
 *  doesn't pan/zoom while interacting with it. */
export const Panel = memo(function Panel({
  position = 'top-left',
  className,
  style,
  children,
}: PanelProps) {
  return (
    <div
      className={`rf-panel rf-panel-${position}${className ? ` ${className}` : ''}`}
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
});
