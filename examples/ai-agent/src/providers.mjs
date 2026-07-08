// Provider-agnostic bridge from an LLM to RealFlow's JSON operation format.
//
// The same prompt + parser work across GLM (z.ai, OpenAI-compatible), Gemini
// (Google structured output) and Anthropic. Whichever API key is present in the
// environment decides the provider. No SDKs — plain fetch — so this file has
// zero dependencies beyond @realflow/core and the Node built-in fetch.
import { describeGraph, OPERATIONS_PROMPT } from '@realflow/core';

/** Pick a provider from an explicit override or whichever key is set. */
export function detectProvider(env = process.env) {
  const explicit = env.REALFLOW_AI_PROVIDER;
  if (explicit) return explicit;
  if (env.GLM_API_KEY) return 'glm';
  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) return 'gemini';
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

/** System + user messages that teach any model the operation format. */
export function buildPrompt(store, goal) {
  const graph = describeGraph(store);
  const system =
    `${OPERATIONS_PROMPT}\n\n` +
    `Respond with ONLY a JSON object of the exact shape {"operations":[ ... ]}. ` +
    `No prose, no code fences. Reference only ids that exist in the current graph when connecting.`;
  const user =
    `Current graph (JSON):\n${JSON.stringify(graph)}\n\n` +
    `Task: ${goal}\n\n` +
    `Return the operations that accomplish the task.`;
  return { system, user };
}

/** Pull the operations array out of a model's text response, tolerantly. */
export function extractOperations(text) {
  if (typeof text !== 'string') throw new Error('model returned no text');
  // Strip ```json fences if the model added them despite instructions.
  const cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Last resort: grab the first {...} or [...] block.
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) throw new Error(`model output was not JSON: ${text.slice(0, 120)}`);
    parsed = JSON.parse(match[1]);
  }
  const ops = Array.isArray(parsed) ? parsed : parsed?.operations;
  if (!Array.isArray(ops)) throw new Error('response had no "operations" array');
  return ops;
}

async function postJson(url, init, fetchImpl) {
  const res = await fetchImpl(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${url} → ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ── provider transports: each returns the model's raw text ────────────────
async function callGlm({ key, model, baseUrl, system, user, fetchImpl }) {
  const json = await postJson(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    },
    fetchImpl
  );
  return json?.choices?.[0]?.message?.content ?? '';
}

async function callGemini({ key, model, baseUrl, system, user, fetchImpl }) {
  const json = await postJson(
    `${baseUrl}/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    },
    fetchImpl
  );
  return (json?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
}

async function callAnthropic({ key, model, baseUrl, system, user, fetchImpl }) {
  const json = await postJson(
    `${baseUrl}/messages`,
    {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0.2,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    },
    fetchImpl
  );
  return (json?.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');
}

const TRANSPORTS = { glm: callGlm, gemini: callGemini, anthropic: callAnthropic };

function providerConfig(provider, env) {
  switch (provider) {
    case 'glm':
      return {
        key: env.GLM_API_KEY,
        model: env.GLM_MODEL || 'glm-4.6',
        baseUrl: env.GLM_BASE_URL || 'https://api.z.ai/api/paas/v4',
      };
    case 'gemini':
      return {
        // Google SDKs accept GEMINI_API_KEY or GOOGLE_API_KEY interchangeably.
        key: env.GEMINI_API_KEY || env.GOOGLE_API_KEY,
        model: env.GEMINI_MODEL || 'gemini-2.5-flash',
        baseUrl: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
      };
    case 'anthropic':
      return {
        key: env.ANTHROPIC_API_KEY,
        model: env.ANTHROPIC_MODEL || 'claude-sonnet-5',
        baseUrl: env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
      };
    default:
      return null;
  }
}

/**
 * Ask the configured LLM for the operations that accomplish `goal` against the
 * current `store`. Returns { provider, operations, text }. Never mutates the
 * store — feed the operations to applyOperations() to apply them.
 */
export async function generateOperations({ store, goal, provider, env = process.env, fetchImpl }) {
  const chosen = provider || detectProvider(env);
  if (!chosen) {
    throw new Error(
      'No AI provider key found. Set one of GLM_API_KEY, GEMINI_API_KEY or ANTHROPIC_API_KEY.'
    );
  }
  const transport = TRANSPORTS[chosen];
  const cfg = providerConfig(chosen, env);
  if (!transport || !cfg) throw new Error(`unknown provider "${chosen}"`);
  if (!cfg.key) throw new Error(`missing API key for provider "${chosen}"`);

  const { system, user } = buildPrompt(store, goal);
  const text = await transport({ ...cfg, system, user, fetchImpl: fetchImpl || fetch });
  return { provider: chosen, operations: extractOperations(text), text };
}
