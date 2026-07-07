# PROGRESS.md — honest status against the acceptance gates

Updated as work lands. Every ✅ is backed by code + a passing test or a
reproducible measurement. Gaps are listed plainly, not hidden.

## Gate A — production-ready & high performance

| Requirement | Status | Evidence |
| --- | --- | --- |
| npm-publishable (exports/types/sideEffects/peerDeps, semver) | ✅ | `npm pack --dry-run` clean for core/react/compat; `API_STABILITY.md`; `CHANGELOG.md` |
| CI: typecheck + tests + build | ✅ | `.github/workflows/ci.yml` (build, typecheck, test, demo build, pack verify) |
| Head-to-head benchmark, reproducible, prod builds, both actually pan | ✅ | `npm run bench` → `benchmarks/BENCHMARKS.md`; movement-verified; ReFlow wins the realistic edit scenario 43 vs 4–9 fps @10k, 13× less memory |
| `applyOperations` fuzz test (never-throw) | ✅ | `packages/core/test/ops-fuzz.test.ts` — 30 seeds × hostile input, proto-pollution guard. **Caught 3 real bugs**: two spatial-index infinite-loop DoS (huge dimension / extreme coordinate) and Symbol→number throws — all fixed + regression-tested. |
| Cross-browser Playwright matrix (Firefox/WebKit) + touch E2E | ❌ | Chromium-only so far. Honest gap. |
| Visual regression tests | ❌ | Not implemented. |

Gate A: **substantially met.** The core requirements (publishable, CI,
reproducible honest benchmark, fuzz) are done. Cross-browser matrix and
visual regression remain.

## Gate B — UI-framework compatibility

| Requirement | Status | Evidence |
| --- | --- | --- |
| Nodes/handles/edges don't impose blocking styles; className/style overridable | ✅ | All styling via `rf-*` classes + `--rf-*` variables; `docs/integrations.md` |
| No z-index/portal/pointer conflict with portal menus inside nodes | ✅ | `examples/demo/.../FrameworkScene.tsx` — portal dropdown + `<select>` + number input inside draggable nodes; `rf-nodrag` opt-out; verified in browser (see PROGRESS note) |
| No global CSS leakage; CSS-var theming (light/dark) | ✅ | `packages/react/src/styles.css` is fully scoped; `colorMode` + page `data-theme` |
| Live demo with framework-style nodes | ✅ | "UI frameworks" tab in the demo |
| shadcn/Radix/Base UI theme-token mapping | ✅ (documented) | `docs/integrations.md` maps `--rf-*` → shadcn HSL tokens |

Gate B: **met.** Portal coexistence is proven with the exact pattern
Radix/Base UI use (portal to body + fixed positioning + own pointer
handling). Shadow-DOM isolation is untested (noted as a future item).

## Gate C — AI-native

| Requirement | Status | Evidence |
| --- | --- | --- |
| JSON ops with public schema, validate + reject safely | ✅ | `packages/core/src/ops.ts` `operationSchema`; fuzz-tested |
| Streaming ops → incremental canvas update (no full re-render) | ✅ | `applyOperations(..., {transact:false})`; per-node fine-grained rendering; demo `AIScene.tsx` streams |
| E2E: an AI Assistant generates a workflow → live render + transactional undo | 🟡 | Demo streams a scripted agent building a live pipeline with per-node status + undo. A **live** Anthropic `/v1/messages` call is documented (`docs/ai-integration.md`) but not wired into CI (needs an API key). |
| AI integration guide + tool-schema for first-try correctness | ✅ | `docs/ai-integration.md` + `OPERATIONS_PROMPT` + `operationSchema`; `llms.txt` at repo root |

Gate C: **met** for the shippable surface. The only softness is a *live*
API-key E2E, which is impractical in CI; the operation layer it would call is
fully tested and the pattern is documented + demoed.

## Tier 2 parity (React Flow features ReFlow was missing)

| Feature | Status | Evidence |
| --- | --- | --- |
| NodeResizer | ✅ | `NodeResizer.tsx`; `a11y-features.test.tsx` |
| NodeToolbar | ✅ | `NodeToolbar.tsx`; test |
| Edge reconnection + snapping | ✅ | store `startReconnect`; `clipboard-reconnect.test.ts` |
| Copy/paste/duplicate + id remap | ✅ | store `copy/paste/duplicateSelection`; test; ⌘C/V/D/X |
| useOnSelectionChange, Panel, Background variants | ✅ | hooks + existing components |
| Accessibility (focus, tab order, aria, keyboard nav) | ✅ | focusable nodes, roles/labels, Alt+Arrow nav; `a11y-features.test.tsx` |
| `@reflow/compat` migration adapter | ✅ | `packages/compat` + `compat.test.tsx` (9 tests) + `docs/migration.md` |

Tier 2: **complete.**

## Tier 3 (differentiation) — not yet done, stated honestly

| Item | Status |
| --- | --- |
| Orthogonal edge routing with obstacle avoidance | ❌ Not started. High value; large. Candidate for next milestone. |
| Collaborative (Yjs/CRDT) sync + presence | ❌ Not started. The store's commit/transaction model is a clean seam for it. |
| Interactive docs site with live examples | ❌ Markdown docs only. |
| Worker-based incremental auto-layout | 🟡 Layouts exist and are fast synchronously; not yet offloaded to a worker. |

## Honest bottom line

- The **biggest real win this cycle was a bug fix, not a feature**: culling
  didn't re-run when zooming in from an overview, so the headline
  performance advantage wasn't actually delivered. The head-to-head
  benchmark caught it; it's fixed and regression-tested. This is exactly why
  RULE #0 mattered.
- ReFlow now genuinely beats React Flow in the realistic zoomed-in editing
  scenario (FPS and memory), ties it in the all-visible overview (both
  paint-bound under software rendering), ships a working migration adapter,
  closes the Tier 2 parity gaps, and has a real AI operation layer.
- Not yet #1-defensible without Tier 3 (obstacle-avoiding routing, CRDT
  collab, a docs site) and a cross-browser test matrix. Those are the honest
  remaining bars.
