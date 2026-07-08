import { memo } from 'react';
import type { PeerState } from '@realflow/core';
import { useViewport } from './hooks';

export interface RemoteCursorsProps {
  /** Remote peers from a `Presence` instance. */
  peers: PeerState[];
  /** Default color when a peer has none. */
  defaultColor?: string;
}

/**
 * Renders remote collaborators' cursors (and name labels) in screen space,
 * tracking pan/zoom. Pair with `Presence` from `@realflow/core`.
 */
export const RemoteCursors = memo(function RemoteCursors({
  peers,
  defaultColor = '#6366f1',
}: RemoteCursorsProps) {
  const v = useViewport();
  return (
    <div className="rf-remote-cursors" aria-hidden="true">
      {peers.map((p) => {
        if (!p.cursor) return null;
        const x = p.cursor.x * v.zoom + v.x;
        const y = p.cursor.y * v.zoom + v.y;
        const color = p.color ?? defaultColor;
        return (
          <div
            key={p.id}
            className="rf-remote-cursor"
            style={{ transform: `translate(${x}px, ${y}px)`, ['--rf-cursor' as string]: color }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M2 2l6 14 2.5-5.5L16 8 2 2z"
                fill={color}
                stroke="#fff"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            {p.name ? (
              <span className="rf-remote-cursor-label" style={{ background: color }}>
                {p.name}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
