// One agent turn: ask the model for operations, then apply them to the store
// as a single transactional batch (one undo reverts the whole turn).
import { applyOperations } from '@realflow/core';
import { generateOperations } from './providers.mjs';

/**
 * @param store  a @realflow/core FlowStore
 * @param goal   natural-language instruction for the agent
 * @param opts   { provider?, env?, fetchImpl?, apply? } — apply defaults to
 *               applyOperations with layered auto-layout and no viewport fit
 *               (headless/Node-safe).
 * @returns { provider, operations, result, text }
 */
export async function runAgentTurn(store, goal, opts = {}) {
  const { operations, provider, text } = await generateOperations({ store, goal, ...opts });
  const apply = opts.apply || ((s, ops) => applyOperations(s, ops, { autoLayout: 'layered', fitView: false }));
  const result = apply(store, operations);
  return { provider, operations, result, text };
}
