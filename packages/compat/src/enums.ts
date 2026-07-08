// React Flow ships these as enums; apps compare against Position.Left etc.
// RealFlow uses the string values directly, so the enum values ARE the strings.

export const Position = {
  Left: 'left',
  Top: 'top',
  Right: 'right',
  Bottom: 'bottom',
} as const;
export type Position = (typeof Position)[keyof typeof Position];

export const MarkerType = {
  Arrow: 'arrow',
  ArrowClosed: 'arrowclosed',
} as const;
export type MarkerType = (typeof MarkerType)[keyof typeof MarkerType];

export const ConnectionMode = {
  Strict: 'strict',
  Loose: 'loose',
} as const;
export type ConnectionMode = (typeof ConnectionMode)[keyof typeof ConnectionMode];

export const ConnectionLineType = {
  Bezier: 'bezier',
  Straight: 'straight',
  Step: 'step',
  SmoothStep: 'smoothstep',
  SimpleBezier: 'bezier',
} as const;
export type ConnectionLineType = (typeof ConnectionLineType)[keyof typeof ConnectionLineType];

export const PanOnScrollMode = {
  Free: 'free',
  Vertical: 'vertical',
  Horizontal: 'horizontal',
} as const;
export type PanOnScrollMode = (typeof PanOnScrollMode)[keyof typeof PanOnScrollMode];
