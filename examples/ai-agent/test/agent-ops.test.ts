import { describe, it, expect } from 'vitest';
import { FlowStore, applyOperations } from '@reflow/core';
import { detectProvider, extractOperations, generateOperations } from '../src/providers.mjs';
import { runAgentTurn } from '../src/pipeline.mjs';

// A fake fetch that returns a fixed provider payload — lets us exercise the
// real request-building + response-parsing + apply pipeline with no network
// and no API key. Live keyed calls are covered by `generate.mjs` (manual).
const fakeFetch = (payload: unknown) => async () =>
  ({ ok: true, status: 200, statusText: 'OK', json: async () => payload, text: async () => JSON.stringify(payload) }) as Response;

const OPS = [
  { op: 'add_node', id: 'validate', label: 'Validate payload' },
  { op: 'connect', source: 'fetch', target: 'validate' },
  { op: 'connect', source: 'validate', target: 'save' },
];

const glmPayload = { choices: [{ message: { content: JSON.stringify({ operations: OPS }) } }] };
const geminiPayload = { candidates: [{ content: { parts: [{ text: JSON.stringify({ operations: OPS }) }] } }] };
const anthropicPayload = { content: [{ type: 'text', text: JSON.stringify({ operations: OPS }) }] };

function seedStore() {
  const store = new FlowStore();
  store.setGraph(
    [
      { id: 'fetch', position: { x: 0, y: 0 }, data: { label: 'Fetch' } },
      { id: 'save', position: { x: 300, y: 0 }, data: { label: 'Save' } },
    ],
    [{ id: 'e1', source: 'fetch', target: 'save' }]
  );
  return store;
}

describe('extractOperations', () => {
  it('parses a plain {operations:[...]} object', () => {
    expect(extractOperations(JSON.stringify({ operations: OPS }))).toHaveLength(3);
  });
  it('parses a bare array', () => {
    expect(extractOperations(JSON.stringify(OPS))).toHaveLength(3);
  });
  it('tolerates ```json code fences', () => {
    expect(extractOperations('```json\n' + JSON.stringify({ operations: OPS }) + '\n```')).toHaveLength(3);
  });
  it('throws a clear error on non-JSON', () => {
    expect(() => extractOperations('sorry, I cannot do that')).toThrow(/not JSON/i);
  });
});

describe('detectProvider', () => {
  it('honours an explicit override', () => {
    expect(detectProvider({ REFLOW_AI_PROVIDER: 'gemini', GLM_API_KEY: 'x' })).toBe('gemini');
  });
  it('falls back to whichever key is present', () => {
    expect(detectProvider({ GLM_API_KEY: 'x' })).toBe('glm');
    expect(detectProvider({ GEMINI_API_KEY: 'x' })).toBe('gemini');
    expect(detectProvider({ ANTHROPIC_API_KEY: 'x' })).toBe('anthropic');
    expect(detectProvider({})).toBeNull();
  });
});

describe('generateOperations across provider response shapes', () => {
  const cases = [
    { provider: 'glm', env: { GLM_API_KEY: 'k' }, payload: glmPayload },
    { provider: 'gemini', env: { GEMINI_API_KEY: 'k' }, payload: geminiPayload },
    { provider: 'anthropic', env: { ANTHROPIC_API_KEY: 'k' }, payload: anthropicPayload },
  ];
  for (const c of cases) {
    it(`extracts operations from a ${c.provider} response`, async () => {
      const store = seedStore();
      const { provider, operations } = await generateOperations({
        store,
        goal: 'insert a validation step',
        env: c.env,
        fetchImpl: fakeFetch(c.payload),
      });
      expect(provider).toBe(c.provider);
      expect(operations).toHaveLength(3);
    });
  }

  it('throws when no provider key is set', async () => {
    await expect(
      generateOperations({ store: seedStore(), goal: 'x', env: {}, fetchImpl: fakeFetch(glmPayload) })
    ).rejects.toThrow(/no ai provider/i);
  });
});

describe('runAgentTurn applies operations transactionally', () => {
  it('creates the proposed nodes/edges and one undo reverts the whole turn', async () => {
    const store = seedStore();
    const { result } = await runAgentTurn(store, 'insert a validation step', {
      env: { GLM_API_KEY: 'k' },
      fetchImpl: fakeFetch(glmPayload),
    });
    expect(result.errors).toHaveLength(0);
    expect(result.createdNodes).toContain('validate');
    expect(result.createdEdges).toHaveLength(2);
    expect(store.getNodes().map((n) => n.id).sort()).toEqual(['fetch', 'save', 'validate']);

    store.undo(); // whole agent turn is a single history entry
    expect(store.getNodes().map((n) => n.id).sort()).toEqual(['fetch', 'save']);
    expect(store.getEdges()).toHaveLength(1);
  });

  it('never throws on hostile model output; bad ops are collected as errors', () => {
    const store = seedStore();
    const junk = [
      { op: 'connect', source: 'ghost', target: 'save' }, // missing node
      { op: 'add_node', id: 'fetch' }, // duplicate id
      { op: 'nonsense' },
    ] as never[];
    const result = applyOperations(store, junk, { autoLayout: false, fitView: false });
    expect(result.errors.length).toBe(3);
    expect(result.applied).toBe(0);
  });
});
