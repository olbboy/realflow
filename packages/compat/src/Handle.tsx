import { Handle as ReflowHandle } from '@realflow/react';
import type { CSSProperties, ReactNode } from 'react';
import type { Position } from './enums';

export interface HandleProps {
  /** React Flow uses `type`; ReFlow uses `kind`. */
  type: 'source' | 'target';
  /** React Flow uses `position`; ReFlow uses `side`. */
  position: Position;
  id?: string;
  isConnectable?: boolean;
  isConnectableStart?: boolean;
  isConnectableEnd?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  onConnect?: unknown;
}

/**
 * React Flow-compatible Handle. Maps `type`→`kind` and `position`→`side`.
 */
export function Handle({
  type,
  position,
  id,
  isConnectable,
  className,
  style,
  children,
}: HandleProps) {
  return (
    <ReflowHandle
      kind={type}
      side={position}
      id={id}
      connectable={isConnectable}
      className={className}
      style={style}
    >
      {children}
    </ReflowHandle>
  );
}
