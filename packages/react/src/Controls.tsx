import { memo } from 'react';
import type { ReactNode } from 'react';
import { useHistory, useReflow } from './hooks';
import { Panel, type PanelPosition } from './Panel';

const Icon = ({ d }: { d: string }): React.JSX.Element => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export interface ControlsProps {
  position?: PanelPosition;
  className?: string;
  /** Show undo/redo buttons (built-in history). Default true. */
  showUndoRedo?: boolean;
  showZoom?: boolean;
  showFitView?: boolean;
  children?: ReactNode;
}

/** Zoom / fit / undo / redo buttons with keyboard-consistent behavior. */
export const Controls = memo(function Controls({
  position = 'bottom-left',
  className,
  showUndoRedo = true,
  showZoom = true,
  showFitView = true,
  children,
}: ControlsProps) {
  const api = useReflow();
  const { canUndo, canRedo, undo, redo } = useHistory();
  return (
    <Panel position={position} className={`rf-controls${className ? ` ${className}` : ''}`}>
      {showZoom ? (
        <>
          <button type="button" className="rf-control-btn" title="Zoom in" aria-label="Zoom in" onClick={() => api.zoomIn()}>
            <Icon d="M12 5v14M5 12h14" />
          </button>
          <button type="button" className="rf-control-btn" title="Zoom out" aria-label="Zoom out" onClick={() => api.zoomOut()}>
            <Icon d="M5 12h14" />
          </button>
        </>
      ) : null}
      {showFitView ? (
        <button
          type="button"
          className="rf-control-btn"
          title="Fit view"
          aria-label="Fit view"
          onClick={() => api.fitView({ duration: 300 })}
        >
          <Icon d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </button>
      ) : null}
      {showUndoRedo ? (
        <>
          <button
            type="button"
            className="rf-control-btn"
            title="Undo (⌘Z)"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={undo}
          >
            <Icon d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </button>
          <button
            type="button"
            className="rf-control-btn"
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={redo}
          >
            <Icon d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
          </button>
        </>
      ) : null}
      {children}
    </Panel>
  );
});
