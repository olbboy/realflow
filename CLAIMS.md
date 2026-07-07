# CLAIMS.md — ground-truth audit

Every headline claim, cross-checked against **code + passing tests +
reproducible measurement**. Nothing is marked ✅ on the strength of a README
sentence or a comment. Updated whenever a claim changes.

Legend: ✅ HAVE (code + test/measurement) · 🟡 PARTIAL · ❌ MISSING · ⚠️ WAS-FALSE (found & corrected)

## Performance

| Claim | Status | Evidence |
| --- | --- | --- |
| Fine-grained per-node/edge subscriptions | ✅ | `store.ts` topic emits; `store.test.ts` "fine-grained notifications" |
| Direct-DOM pan/zoom (zero React render) | ✅ | `ReFlow.tsx` viewport effect writes `style.transform`; benchmark shows pan doesn't scale with React tree |
| Spatial-hash viewport culling, on by default | ✅ | `spatial.ts` + `store.cull()`; `spatial.test.ts` 10k query <100ms; benchmark edit row: 143 DOM of 10k |
| Culling works when zooming in from overview | ⚠️→✅ | **WAS BROKEN** — hysteresis skipped re-cull on zoom-in, leaving all nodes rendered. Fixed (`lastCullZoom`); regression test "re-culls when zooming IN from an overview" |
| "~55 fps at 10k nodes" (old README) | ⚠️ | **FICTIONAL number, removed.** Replaced with reproducible benchmark table. Real: overview 10k ≈ 4fps (paint-bound, software render); edit 10k ≈ 43fps |
| Faster than React Flow | 🟡 | TRUE in realistic zoomed-in editing (43 vs 4–9 fps @10k, 13× less memory). ROUGHLY TIED in all-visible overview (both paint-bound). See `benchmarks/BENCHMARKS.md` |
| Canvas MiniMap | ✅ | `MiniMap.tsx` uses `<canvas>`, no per-node elements |
| Batched handle measurement (one RO) | ✅ | `measure.ts` shared ResizeObserver + read/write split |

## Features

| Claim | Status | Evidence |
| --- | --- | --- |
| Undo/redo, transactional, drag-coalescing | ✅ | `store.ts` history; `store.test.ts` undo/redo suite |
| Auto-layout: layered/tree/force/radial/grid, zero deps | ✅ | `layout.ts`; `layout.test.ts` (11 tests incl. no-overlap, cycles) |
| Alignment guides + snap | ✅ | `guides.ts`; `store.test.ts` "alignment guides" |
| Typed ports, cycle prevention, max-connections | ✅ | `store.validateCandidate`; `store.test.ts` connection suite |
| Graph algorithms (topo/cycle/components/path) | ✅ | `algorithms.ts`; `algorithms.test.ts` |
| Subflows / groups, re-parent on delete | ✅ | `store.ts` children; `store.test.ts` "reparents children" |
| Controlled + uncontrolled modes | ✅ | `ReFlow.tsx` setGraph diff-sync; `react.test.tsx` controlled-mode |
| Box select, keyboard shortcuts | ✅ | `ReFlow.tsx`; exercised in `scripts/e2e-smoke.mjs` |
| Two-finger pinch zoom, panOnScroll | ✅ | `ReFlow.tsx` touch/pinch + wheel handlers (unit-level; not yet E2E-touch-tested → see gaps) |
| Edge labels/markers, bezier/smoothstep/step/straight | ✅ | `paths.ts` + `EdgeRenderer.tsx`; `paths.test.ts`, `react.test.tsx` markers |
| SSR-safe | 🟡 | Browser APIs guarded in code; **no SSR render test yet** |

## AI integration

| Claim | Status | Evidence |
| --- | --- | --- |
| JSON operations + validated executor | ✅ | `ops.ts`; `ops.test.ts` |
| Never-throws on bad input | ✅ | `ops.ts` per-op try/catch **plus input sanitization** (finite/clamped numbers, string coercion, array guards); **fuzz test** `ops-fuzz.test.ts` (30 seeds). Caught & fixed 3 real bugs: 2 spatial-index DoS hangs + Symbol→number throws. |
| LLM tool schema + Mermaid/describeGraph | ✅ | `ops.ts` `operationSchema`, `toMermaid`, `describeGraph`; `ops.test.ts` |
| Streaming ops incremental | ✅ | `applyOperations(..., {transact:false})`; demo `AIScene.tsx` streams |
| Real Anthropic Assistant E2E | ❌ | Documented pattern only; no live API E2E (needs a key). Marked honestly in PROGRESS.md |

## Ecosystem / compat

| Claim | Status | Evidence |
| --- | --- | --- |
| Works with Tailwind/shadcn/Radix/Base UI | 🟡 | Architecturally class-scoped; recipe in `docs/integrations.md`; demo node proves portal/pointer coexistence (task in progress) |
| React Flow API compat adapter | 🟡→✅ | `@reflow/compat` package + `compat.test.tsx` (see PROGRESS.md) |
| npm-publishable | ✅ | `npm pack --dry-run` clean for both packages; exports/types/sideEffects set |
| CI runs typecheck+test+build | ✅ | `.github/workflows/ci.yml` |

## Known gaps (see PROGRESS.md for the live list)

- Orthogonal edge routing with obstacle avoidance — ❌ not implemented
- CRDT/Yjs collaborative sync — ❌ not implemented
- Cross-browser Playwright matrix (Firefox/WebKit) + touch E2E — ❌ Chromium only so far
- Visual regression tests — ❌
- Live docs site — ❌ (markdown docs only)
- Overview-mode (all-nodes-visible) pan is paint-bound and slow under software
  rendering for BOTH libraries; a WebGL/canvas node renderer would be the real
  fix. Honest limitation, not hidden.
