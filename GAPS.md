# GAPS — where React Flow (and its paid Pro examples) still win

> Mandatory deliverable of the adversarial audit. This is **not** hidden. "React
> Flow still wins at X" is a legitimate, valuable result. Companion:
> [AUDIT.md](./AUDIT.md).
>
> Pro-example list verified 2026-07-08 against the live
> [reactflow.dev/pro/examples](https://reactflow.dev/pro/examples) — **16** paid
> examples (superset of the 11 in the brief). Each is judged against RealFlow with
> a runnable-evidence-or-it-didn't-happen bar. Verdicts:
> **HƠN** = RealFlow better · **NGANG** = par · **THUA** = React Flow better.

---

## Scoreboard (16 React Flow Pro examples)

| Verdict | Count | Examples |
| --- | --- | --- |
| **HƠN** (RealFlow wins — built-in & MIT-free vs paid) | **12** | Auto Layout · Force Layout · Dynamic Layouting · Edge Routing · Helper Lines · Copy & Paste · Undo & Redo · Collaborative · Server-Side Image · **Selection Grouping** · **Expand & Collapse** · **Node Position Animation** |
| **NGANG / partial** | **1** | Parent–Child Relation (data model ✅, drag-to-attach gesture ❌) |
| **THUA** (React Flow wins — RealFlow gap) | **3** | Editable Edge · Freehand Draw · Shapes |

> **Closed by migration (with tests + live proof):**
> - **Server-Side Image** → headless `toSvg(store)` (`svg-export.test.ts`, 6) + demo "⤓ SVG"; output rendered & verified.
> - **Selection Grouping** → `store.groupSelection()` / `ungroup()` (`grouping.test.ts`, 6) + demo "⧉ Group"; group container renders live.
> - **Expand & Collapse** → `collapseNode` / `expandNode` / `toggleCollapse` (`collapse.test.ts`, 6, incl. nested) + demo "⊟ Collapse"; subtree hides live.
> - **Node Position Animation** → `layout({ animate })` + scoped CSS transition (`layout-api.test.tsx`, +2) + drag-clear guard; live computed style confirms `transition: transform 0.35s` on layout.

**Honest headline:** RealFlow genuinely puts React Flow's paywall features in the
box for free — the whole layout family, edge routing, undo/redo, copy-paste,
collaboration, alignment guides, vector image export, grouping, expand/collapse,
and position tweening — **12 clean wins, all test-backed**. It does **not** yet
cover 3 React Flow Pro **canvas-drawing tools** (freehand, shapes, draggable edge
control points) plus the Parent–Child **drag-to-attach gesture** — the remaining
real gaps. So RealFlow is **not** a strict superset of React Flow Pro, and the
README's "most complete" framing over-reaches (flagged in AUDIT.md §4).

---

## Full head-to-head (all 16)

Paid? = is it behind React Flow Pro. "LoC to build in RealFlow" = lines a user
writes to reproduce the example (✅ built-in ⇒ near-zero). Perf/DX noted where
measured.

| # | Pro example | Paid? | RealFlow | LoC for user | Verdict | Evidence |
| --- | --- | :---: | --- | ---: | :---: | --- |
| 1 | Auto Layout (dagre/elk/d3-force) | 💰 | Built-in `flow.layout('layered'\|'tree'\|'force'\|'radial'\|'grid')`, **zero deps** | ~1 | **HƠN** | `layout.test.ts` (11); live demo buttons |
| 2 | Force Layout | 💰 | Built-in `layout('force')`, deterministic seeded FR | ~1 | **HƠN** | `layout.test.ts` |
| 3 | Dynamic Layouting (incremental) | 💰 | Built-in `layoutIncremental(newIds)` — place new nodes without moving the graph; **off-thread** `layoutAsync` via worker | ~1 | **HƠN** | `layout-worker.test.ts` (7, real `worker_threads`) |
| 4 | Edge Routing (around nodes) | 💰 | Built-in orthogonal Hanan-grid **A\*** with obstacle avoidance, live re-route | ~0 | **HƠN** | `routing.ts`; `routing.test.ts` (7); "Smart routing" demo tab |
| 5 | Helper Lines (align + snap) | 💰 | Built-in, **on by default**, Figma-style + `snapGrid` | ~0 | **HƠN** | `guides.ts`; `store.test.ts` |
| 6 | Copy & Paste | 💰 | Built-in ⌘C/V/D/X, id-remapped, one undo | ~0 | **HƠN** | `clipboard-reconnect.test.ts` (7) |
| 7 | Undo & Redo | 💰 | Built-in, **transactional**, drag-coalescing, `useHistory()` | ~0 | **HƠN** | `store.test.ts` undo suite; live ⌘Z. (React Flow's flagship Pro example — free here) |
| 8 | Collaborative (Yjs) | 💰 | Built-in transport-agnostic CRDT (Lamport LWW) + `RemoteCursors` presence, Yjs interop | ~10 | **HƠN** | `collab.test.ts` (6) + `collab-yjs.test.ts` (real Yjs) |
| 9 | Parent–Child Relation | 💰 | `parentId` nesting, children move w/ parent (1 transform), `extent:'parent'` clamp, reparent-on-delete — **but no drag-to-attach gesture** | ~5 | **NGANG** | `store.test.ts` "reparents children"; gesture gap below |
| 10 | Editable Edge (control points) | 💰 | Endpoint **reconnect** ✅; draggable **mid-edge control points ❌** | — | **THUA** | `EdgeRenderer.tsx` reconnect only |
| 11 | Expand & Collapse | 💰 | **Built-in** `collapseNode`/`expandNode`/`toggleCollapse` — hides edge-descendants, nested composes | ~2 | **HƠN** | `collapse.test.ts` (6); demo "⊟ Collapse", subtree hides live |
| 12 | Node Position Animation | 💰 | **Built-in** `layout({ animate })` — scoped `transition:transform` armed for the layout window, cleared on drag | ~0 | **HƠN** | `layout-api.test.tsx` (+2); live computed `transition: transform 0.35s` |
| 13 | Selection Grouping (box → group) | 💰 | **Built-in** `groupSelection()`/`ungroup()` — container sized to bbox, members rebased, one undo | ~2 | **HƠN** | `grouping.test.ts` (6); demo "⧉ Group", container renders live |
| 14 | Freehand Draw | 💰 | ❌ not implemented | — | **THUA** | no source match |
| 15 | Shapes / Whiteboard | 💰 | ❌ not implemented | — | **THUA** | no source match |
| 16 | Server-Side Image Creation | 💰 | **Built-in `toSvg(store)`** — pure, headless, deterministic, vector (also runs server-side); demo "⤓ SVG" button | ~3 | **HƠN** | `svg-export.test.ts` (6); output rendered & verified. Vector + zero-dep vs React Flow's html-to-image PNG |

Bonus context not in the Pro list but relevant: **NodeResizer, NodeToolbar, edge
reconnection, viewport culling, canvas MiniMap, typed ports, graph algorithms**
are all built-in and test-backed (see CLAIMS.md) — several are also paywalled or
DIY in React Flow.

---

## Backlog — closing the remaining gaps (concrete, sized)

Ordered cheapest → hardest. Each is a real task, not a wish. Four gaps were
closed this session (Server-Side Image, Selection Grouping, Expand & Collapse,
Node Position Animation — see scoreboard).

1. **Parent–Child drag-to-attach (#9 gesture) — ~1–2 days.** On drag-stop, hit-test
   the node against group bounds; set/clear `parentId` with position rebasing;
   toolbar "detach". Store already reparents (and now `groupSelection`/`ungroup`
   exist); this is the missing gesture layer. Turns the one NGANG into HƠN.
2. **Editable Edge control points (#10) — ~1–2 days.** Store optional
   `edge.controlPoints`; render draggable handles on selected edges; feed points
   into the bezier/linear path builder in `paths.ts`. Reconnect already exists, so
   this is additive.
3. **Freehand Draw (#14) + Shapes (#15) — ~3–5 days together.** A drawing mode:
   pointer capture → stroke (perfect-freehand or self-rolled) → a selectable,
   resizable freehand/shape node type (rect/ellipse/diamond via SDF or SVG). The
   biggest gap — a new interaction mode, not just a node type.

**Total to strict Pro parity: ~1 focused week.** None are blocked; all reuse
existing store/layout/path primitives.

---

## Why these gaps exist (honest architecture read)

RealFlow optimized for the **headless engine + performance** thesis: a
zero-dependency core (store, spatial index, layout, routing, history, algorithms,
AI ops) that wins the data/perf battles decisively (see AUDIT.md §3 — flat 120fps
at 10k while editing). React Flow Pro invested more in **canvas-authoring UX**
(freehand, shapes, image export, edge editing). The two libraries made different
bets. RealFlow's bets pay off where they're aimed; the gaps are exactly the
places it didn't aim yet.

Sources: [React Flow Pro Examples](https://reactflow.dev/pro/examples) ·
[Collaborative](https://reactflow.dev/examples/interaction/collaborative) ·
[Auto Layout](https://reactflow.dev/examples/layout/auto-layout)
