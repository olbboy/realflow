# Adversarial audit — RealFlow vs React Flow

> Role: adversarial reviewer of RealFlow. Default stance is **doubt**; a claim is
> accepted only with a runnable repro. "React Flow still wins at X" is a valid,
> valued result and is recorded plainly (see [GAPS.md](./GAPS.md)).
>
> Companion docs: [CLAIMS.md](./CLAIMS.md) (line-by-line README audit),
> [GAPS.md](./GAPS.md) (where React Flow / its Pro examples still win, with the
> full 11-feature head-to-head), [benchmarks/BENCHMARKS.md](./benchmarks/BENCHMARKS.md)
> (checked-in CI baseline).
>
> Date: 2026-07-08. Machine: macOS (Apple Silicon), Chromium via Playwright
> **with GPU** (not the CI software-rendering baseline). Every number below is
> reproduced first-hand, not copied from the README.

---

## 0. What was verified first-hand this pass

| Check | Command | Result |
| --- | --- | --- |
| Unit/integration tests | `npm test` | **144 passed** (18 files) |
| Type safety | `npm run typecheck` | clean (core + react + compat) |
| Lint | `npm run lint` | clean |
| Build (all 3 packages) | `npm run build` (+ `-w @realflow/compat`) | clean, ESM output |
| Demo renders | `npm run dev` → screenshot | renders; **0 console errors** |
| Benchmark | `npm run bench -w realflow-benchmarks` | ran end-to-end, reproduced (§3) |
| Brand rename | `git grep -li reflow` (whole tree) | **0 leftovers** |

---

## 1. Rename `reflow` → `realflow` (Part 2) — VERIFIED

Clean rename, no back-compat alias (pre-1.0, no external consumers — a clean
break beats a deprecated shim that would keep the old name grep-visible).

- Public API is now `RealFlow`, `RealFlowProvider`, `useRealFlow()` → `RealFlowApi`.
- npm scope already `@realflow/*`; internal workspaces renamed
  (`realflow-monorepo`, `realflow-demo`, `realflow-benchmarks`, `realflow-docs-site`,
  `realflow-ai-agent`); lockfile regenerated.
- Files renamed: `ReFlow.tsx`→`RealFlow.tsx`, `reflow.html`→`realflow.html`,
  `reflow-app.tsx`→`realflow-app.tsx`.
- Env var `REFLOW_AI_PROVIDER`→`REALFLOW_AI_PROVIDER` (code, test, `.env.example`).

**CSS prefix deliberately kept `rf-` / `--rf-`.** It is brand-neutral initials
("RealFlow" as readily as "ReFlow"), contains no `reflow` substring, and renaming
it would churn every consumer's style overrides for zero correctness gain. Called
out here so it is a decision, not an oversight.

**Verdict: DONE.** `git grep -li reflow` over the entire tracked tree returns
nothing; build + 144 tests + typecheck + lint + live demo all green *after* the
rename. The only typecheck breakage during the rename was a stale pre-rename
`.d.ts` in a build folder; a clean rebuild cleared it — the source rename was
internally consistent.

---

## 2. Benchmark methodology audit (Part 1)

Audited `benchmarks/run.mjs` + `benchmarks/src/*` line by line before trusting any
number. The prompt's five fairness gates, judged:

| # | Fairness gate | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Apples-to-apples (same scene, both **prod** builds, same React/browser/viewport) | **PASS** | `vite build` prod for both; `scene.ts` is one deterministic generator feeding both apps; both mount full-viewport 1440×900; single root React instance in the monorepo; both use each library's **default node** (no custom `nodeTypes`) — RealFlow's default node is if anything *heavier* than React Flow's gray box, so RealFlow is not winning via simpler DOM |
| 2 | Measures the right thing (real frame timing, not vibes) | **PASS** | FPS = rAF frames counted over a real 2s pan (`PAN_FN`), not perceived; DOM node count via `locator.count()`; heap via `performance.memory.usedJSHeapSize` after a forced `gc()`; mount ms from a `__RENDER_START` mark |
| 3 | Not rigged (same feature level, no hidden culling advantage) | **PASS — and then some** | In edit mode RealFlow keeps **143** DOM nodes vs React Flow's own cull mode at **49**. RealFlow renders **3× more** nodes and still wins on FPS — it is explicitly *not* winning by hiding more. Culling is reported as a separate React Flow config (`onlyRenderVisibleElements`), not cherry-picked away |
| 4 | Frozen-canvas trap avoided | **PASS** | Every row asserts the viewport transform actually changed (`moved`), else it prints `⚠️frozen`. A frozen canvas cannot fake 60fps here |
| 5 | Both libraries genuinely pan | **PASS** | `PAN_FN` dispatches **both** PointerEvents (RealFlow) and window-level MouseEvents (React Flow's d3-zoom listens on `window`), so neither library sits still |

**Methodology verdict: SOUND.** One honesty upgrade applied to the reading of the
results — see §3's nuance about `onlyRenderVisibleElements`.

The prompt's demand — "if the old benchmark violated apples-to-apples, declare it
INVALID and re-run" — did not trigger: the harness was already fair. It was
re-run anyway (§3).

---

## 3. Reproduced benchmark (real GPU, this machine)

Full re-run of `npm run bench`. The checked-in `BENCHMARKS.md` is the CI
**software-rendering** baseline (no GPU); this machine has a GPU, so absolute FPS
is much higher for **both** libraries — exactly as the harness's own caveat
predicts. The hardware-independent columns (DOM count, heap) are the load-bearing
proof and they reproduce.

**Editing scenario (zoomed 1:1 — the realistic authoring case):**

| Nodes | Library | Pan FPS | DOM nodes | Heap MB |
| ---: | --- | ---: | ---: | ---: |
| 10000 | **RealFlow** | **120** | **143** | **28** |
| 10000 | React Flow (default) | 22 | 10000 | 242 |
| 10000 | React Flow (onlyRenderVisible) | 56 | 49 | 33 |
| 5000 | **RealFlow** | **120** | 143 | 11 |
| 5000 | React Flow (default) | 47 | 5000 | 125 |
| 5000 | React Flow (onlyRenderVisible) | 96 | 49 | 21 |

**Overview scenario (every node on-screen — paint-bound):**

| Nodes | Library | Pan FPS | DOM nodes | Heap MB |
| ---: | --- | ---: | ---: | ---: |
| 10000 | RealFlow | 14 | 10000 | 117 |
| 10000 | React Flow (default) | 14 | 10000 | 242 |
| 10000 | React Flow (onlyRenderVisible) | 9 | 10000 | 215 |

**What reproduces (accepted):**
- **DOM counts are exact and deterministic** — RealFlow 143, React Flow default = N,
  cull = 49, at every size. This is the culling claim, *proven*.
- **Memory direction confirmed** — editing 10k: 28 MB vs 242 MB (**~8.6× less**)
  vs React Flow default. Overview 10k: ~2× less. The README's "~13×" is the CI
  software-rendering figure (18 vs 239); on GPU it's ~8.6×. Same direction, same
  order of magnitude → **KEEP with the multiplier scoped to config** (see §4).
- **Edit-mode FPS story holds and is decisive** — RealFlow is flat **120fps at
  1k/5k/10k** (culling + zero-React-render pan); React Flow default collapses
  121→47→22 as the graph grows.

**Honesty nuance the README under-states (FIX):** against React Flow's **own**
opt-in culling (`onlyRenderVisibleElements`) on real GPU hardware, the gap is
narrower than the CI numbers imply. At 10k edit: RealFlow **120fps / 28 MB** vs
cull **56fps / 33 MB** — RealFlow still wins FPS ~2×, but **memory is nearly tied**
(28 vs 33 MB), because that memory win comes from culling, which React Flow can
also do. RealFlow's durable, architecture-level edge over *cull-enabled* React
Flow is the **2× FPS** (zero-render pan), not memory. The "13× less memory"
headline is true only against React Flow's **default** (culling off) — which is a
fair "out-of-the-box" comparison, but it must be labeled as such.

---

## 4. Claim-by-claim verdict (KEEP / FIX / REJECT)

Against the README + CLAIMS.md. `KEEP` = reproduced/true as written; `FIX` = true
but needs scoping/wording; `REJECT` = not supported.

| Claim (README) | Verdict | Note |
| --- | --- | --- |
| Undo/redo built-in, transactional, drag-coalescing | **KEEP** | `store.test.ts` undo suite; live ⌘Z |
| Auto-layout built-in (layered/tree/force/radial/grid), zero deps | **KEEP** | `layout.test.ts` (11); live buttons in demo |
| Alignment guides + snapping, on by default | **KEEP** | `guides.ts`; `store.test.ts` |
| Viewport culling on by default, spatial-index | **KEEP** | reproduced: 143 DOM of 10k while editing |
| Pan/zoom = zero React renders (direct DOM transform) | **KEEP** | reproduced: flat 120fps independent of node count |
| Canvas MiniMap (no per-node React elements) | **KEEP** | `MiniMap.tsx` → `<canvas>` |
| Typed ports, cycle prevention | **KEEP** | `store.validateCandidate`; connection tests |
| AI ops + validated executor, **never throws** | **KEEP** | `ops-fuzz.test.ts`: 3000 hostile ops × 30 seeds, proto-pollution guard, caught a real DoS |
| Orthogonal routing w/ obstacle avoidance | **KEEP** | `routing.ts` Hanan-grid A*; `routing.test.ts` (7) |
| Real-time collaboration + presence, Yjs-ready | **KEEP** | `collab.ts`; `collab-yjs.test.ts` real Yjs interop |
| Copy/paste/duplicate built-in | **KEEP** | `clipboard-reconnect.test.ts` |
| Compat adapter for React Flow migration | **KEEP** | `compat.test.tsx` (9) |
| shadcn/Radix + Base UI work inside nodes | **KEEP** | reproduced live: Radix Popover + Select open & position correctly inside a draggable node; Base UI node renders |
| "**~13× less memory** than React Flow" | **FIX** | true vs React Flow **default** (culling off). vs `onlyRenderVisibleElements` it's ~1.2×. Scope the multiplier to the config |
| "10,000 nodes … Pan 43 fps" (headline table) | **FIX** | 43 is the CI **software-rendering** figure. Real GPU = 120fps. Both honest; the table should say which rig, as BENCHMARKS.md already does |
| "the most **complete** … library" / "features other libraries put behind a paywall built in" | **FIX** | true for the features RealFlow *has* (undo, culling, layout, guides, routing, collab). But it is **not** a superset of React Flow Pro: 7 of the 11 Pro **examples** are not covered (freehand, shapes, image export, editable-edge control points, expand/collapse placeholders, dynamic drag-grouping, per-node position animation). "Complete" over-reaches — see GAPS.md |
| SSR-safe | **KEEP (as 🟡)** | code guards browser APIs; no SSR render test yet — CLAIMS.md already flags this honestly |

No claim graded **REJECT**: nothing in the README is fabricated. The corrections
are all *scoping* ("vs which config", "which rig", "complete for what") rather than
falsehoods. The one materially misleading framing is **"complete"** — addressed in
GAPS.md.

**Gaps closed this pass (proof-by-migration).** To demonstrate the audit is not
only documentation, **six** React Flow Pro gaps were ported to real, tested,
live-verified features (each THUA/NGANG → HƠN):

1. **Server-Side Image** → headless `toSvg(store)` (`svg-export.test.ts`, 6; XML-injection-safe); demo "⤓ SVG"; output rendered.
2. **Selection Grouping** → `groupSelection()`/`ungroup()` (`grouping.test.ts`, 6); demo "⧉ Group"; container renders live.
3. **Expand & Collapse** → `collapseNode`/`expandNode`/`toggleCollapse` (`collapse.test.ts`, 6, incl. nested); demo "⊟ Collapse"; subtree hides live.
4. **Node Position Animation** → `layout({ animate })` + scoped CSS transition (`layout-api.test.tsx`, +2, drag-clear guard); live computed `transition: transform 0.35s`.
5. **Parent–Child drag-to-attach** → `reparentOnDrop` in `endDrag` (`reparent-on-drop.test.ts`, 6, cycle-guarded) + `reparentOnDrop` prop; live drag nests a node in a group (DOM + rebased position).
6. **Editable Edge** → `edge.controlPoints` + `splinePath` + draggable handles / double-click (`editable-edges.test.ts`, 5); live spline renders through the control point.

Scoreboard now **14 win / 0 partial / 2 gap** (was 9/1/6). Test count 144 → 175.
Only React Flow Pro's two canvas *drawing modes* remain — **Freehand Draw** and
**Shapes/Whiteboard**. See GAPS.md.

---

## 5. Three-axis verification (Part 4)

**Production / perf — PASS.** Prod builds for all three packages; ESM loads under
native Node (CLAIMS.md records CI `import()` of each); benchmark reproduces
prod-vs-prod at 1k/5k/10k (§3). `npm pack` cleanliness spot-checked (see §6 open
item on stale build artifacts — now cleaned locally).

**UI-framework compat — PASS (live).** The "UI frameworks" demo tab renders nodes
built from **real** shadcn/ui (Radix) and **real** Base UI. Verified first-hand:
opening a node's "…" menu pops a Radix Popover that portals and positions
correctly over the canvas; Select dropdowns render; no z-index/pointer/portal
conflict with pan/zoom. Backed by `e2e/framework-nodes.spec.ts` (5 specs ×
Chromium/Firefox/WebKit).

**AI-native — PASS (live + fuzz).** `applyOperations` is the untrusted-LLM
boundary and is fuzz-hardened: `ops-fuzz.test.ts` throws 3000 random hostile ops
(incl. `__proto__` payloads, `1e308` dimensions, path-traversal strings) and
asserts never-throws + no dangling edges + no prototype pollution + every rejected
op carries a reason (no silent drops) + a 500-op batch reverts in one undo. The
"AI copilot" demo tab renders an agent driving the canvas live via
`applyOperations(store, ops)` with animated `set_status` execution. Live keyed run
(Gemini) is CLI-local, not CI (needs a secret) — CLAIMS.md flags this.

---

## 6. Unresolved questions / open items

1. **GitHub URLs** now point to `github.com/olbboy/realflow` (rebranded). They
   404 until the repo itself is renamed on GitHub (GitHub auto-redirects renamed
   repos, so old `…/reflow` links keep working once renamed). **User action:**
   rename the GitHub repo, or revert these URLs to `…/reflow`.
2. **`onlyRenderVisibleElements` framing** — should the README's "13× memory"
   headline be re-scoped to "vs React Flow default (culling off)"? Recommended
   yes; it's the only materially over-stated number.
3. **"Complete" claim** — the README markets against React Flow Pro but omits the
   7 Pro examples RealFlow doesn't yet cover. Recommend softening "most complete"
   → "batteries-included where it counts" and linking GAPS.md.
4. **Stale build artifacts** — `tsc` left pre-rename `ReFlow.*` files in build
   output (gitignored; cleaned locally before `npm pack`). Recommend a clean step
   before publish so no stale file ships.
5. **Changes are staged in the working tree, not committed** (per repo rule:
   commit only when asked).
