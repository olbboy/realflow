// Live AI → RealFlow demo. Reads a goal, asks whichever provider you have a key
// for, applies the returned operations to a headless @realflow/core store, and
// shows the graph before/after plus a single transactional undo.
//
//   GLM_API_KEY=...     node generate.mjs "add a retry step after fetch"
//   GEMINI_API_KEY=...  node generate.mjs
//   ANTHROPIC_API_KEY=... node generate.mjs
import { FlowStore, toMermaid } from '@realflow/core';
import { runAgentTurn } from './src/pipeline.mjs';
import { detectProvider } from './src/providers.mjs';

const goal =
  process.argv.slice(2).join(' ').trim() ||
  'Add a "validate payload" step between fetch and save, and a retry node that runs after fetch on error.';

const store = new FlowStore();
store.setGraph(
  [
    { id: 'fetch', position: { x: 0, y: 0 }, data: { label: 'Fetch data' } },
    { id: 'save', position: { x: 320, y: 0 }, data: { label: 'Save to DB' } },
  ],
  [{ id: 'e1', source: 'fetch', target: 'save' }]
);

const provider = detectProvider();
if (!provider) {
  console.log('No AI provider key set. Set one of GLM_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY and re-run.');
  console.log('\nSeed graph:\n' + toMermaid(store));
  process.exit(0);
}

console.log(`Provider: ${provider}\nGoal: ${goal}`);
console.log('\nBefore:\n' + toMermaid(store));

const { operations, result } = await runAgentTurn(store, goal);
console.log(
  `\nModel proposed ${operations.length} operations · applied ${result.applied} · errors ${result.errors.length}`
);
for (const e of result.errors) console.log(`  ! #${e.index} ${e.error}`);
console.log('\nAfter:\n' + toMermaid(store));

store.undo(); // one ⌘Z reverts the entire agent turn
console.log('\nAfter one undo (whole turn reverted):\n' + toMermaid(store));
