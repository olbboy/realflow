import { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type { FlowConfig } from './types';

export const ConfigContext = createContext<FlowConfig | null>(null);

export const useConfig = (): FlowConfig => {
  const cfg = useContext(ConfigContext);
  if (!cfg) throw new Error('[reflow] useConfig outside <ReFlow>');
  return cfg;
};

/** The scrolling container element, for client → flow coordinate math. */
export const ContainerContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export const useContainer = (): RefObject<HTMLDivElement | null> => {
  const ref = useContext(ContainerContext);
  if (!ref) throw new Error('[reflow] useContainer outside <ReFlow>');
  return ref;
};
