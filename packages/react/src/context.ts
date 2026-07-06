import { createContext, useContext } from 'react';
import type { FlowStore } from '@reflow/core';

export const FlowContext = createContext<FlowStore | null>(null);

/** The FlowStore powering the nearest <ReFlow>. */
export const useFlowStore = (): FlowStore => {
  const store = useContext(FlowContext);
  if (!store) {
    throw new Error(
      '[reflow] No FlowStore found. Wrap this component in <ReFlow> (hooks must be used inside it).'
    );
  }
  return store;
};

/** Id of the node being rendered (available inside custom node components). */
export const NodeIdContext = createContext<string>('');

export const useNodeId = (): string => useContext(NodeIdContext);
