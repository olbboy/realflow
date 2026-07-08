# Contributing to RealFlow

Thanks for taking the time to contribute! RealFlow is a monorepo of small,
focused packages, and it stays that way because contributions come with tests,
docs and — where a performance claim is involved — a reproducible benchmark.

By participating you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** — [open an issue](https://github.com/olbboy/realflow/issues/new/choose)
  with a minimal reproduction (a CodeSandbox/StackBlitz or a failing test is ideal).
- **Propose a feature** — start a [discussion](https://github.com/olbboy/realflow/discussions)
  or a feature-request issue so we can align on scope before you build.
- **Improve docs** — fixes to `docs/`, `README.md` or code comments are always welcome.
- **Send a fix or feature** — see the workflow below.
- **Keep us honest** — if a claim in [CLAIMS.md](./CLAIMS.md), [AUDIT.md](./AUDIT.md)
  or [GAPS.md](./GAPS.md) is wrong or stale, a PR that corrects it is a first-class contribution.

## Prerequisites

- **Node.js ≥ 18** (CI runs on 22) and **npm** (the repo uses npm workspaces).
- A POSIX-ish shell for the build scripts. Windows works via WSL or Git Bash.

## Getting started

```bash
git clone https://github.com/olbboy/realflow && cd realflow
npm install                 # installs all workspaces
npm run build               # build @realflow/core + @realflow/react
npm run build -w @realflow/compat   # compat builds separately
npm test                    # vitest unit + integration
npm run dev                 # showcase + stress scenes at http://localhost:5173
```

## Repository layout

```
packages/
  core/     @realflow/core   — headless engine (store, spatial index, layouts,
                               history, graph algorithms, AI ops). Zero deps.
  react/    @realflow/react  — React renderer (components, hooks, theme).
  compat/   @realflow/compat — React Flow (xyflow) API-compat adapter.
examples/
  demo/       showcase + 1k/5k/10k stress scenes (npm run dev)
  docs-site/  interactive docs gallery (npm run dev:docs)
  ai-agent/   provider-agnostic LLM → operations bridge
benchmarks/   head-to-head benchmark vs React Flow (npm run bench)
e2e/          Playwright cross-browser + visual-regression specs
docs/         guides referenced from the README
```

**Where does my change go?** Logic that could run in Node with no DOM belongs in
`@realflow/core`. Anything that renders or uses React hooks belongs in
`@realflow/react`. `@realflow/compat` should only ever be a thin translation of
the React Flow API onto the RealFlow engine — no new behavior.

## Development scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Build `core` + `react` |
| `npm run build -w @realflow/compat` | Build the compat package |
| `npm test` | Unit + integration tests (vitest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run typecheck` | Strict TS across all packages |
| `npm run lint` / `npm run lint:fix` | ESLint (typescript-eslint + react-hooks) |
| `npm run test:e2e` | Cross-browser + touch E2E (Playwright) |
| `npm run test:e2e:visual` | Visual-regression snapshots |
| `npm run bench` | Reproducible benchmark vs React Flow |

First E2E run needs browsers: `npm run test:e2e:install`.

## Coding conventions

- **TypeScript, strict.** No `any` where a real type is knowable; `npm run typecheck` must pass.
- **`@realflow/core` stays dependency-free.** Do not add a runtime dependency to
  core without a discussion first — the zero-dep guarantee is a headline feature.
- **Fine-grained reactivity.** In `react`, keep renders scoped — a change to one
  node should not re-render the whole graph. If you touch the store or subscription
  layer, add a test that asserts the render scope.
- **Follow the surrounding style.** Match existing naming, file structure and
  comment density. ESLint + the existing patterns are the source of truth.
- **Public API changes** update [API_STABILITY.md](./API_STABILITY.md) and, when
  user-facing, the relevant `docs/` guide and `CHANGELOG.md`.

## Tests are required

- **Bug fix** → a test that fails before your change and passes after.
- **New feature** → tests covering the happy path and the obvious edge cases.
- **Performance claim** → a reproducible benchmark or measurement, not an assertion.
  We do not ship unverified numbers (see [CLAIMS.md](./CLAIMS.md)).

Run the narrowest useful test first, then broaden to `typecheck`, `lint` and
`e2e` if you touched shared contracts or rendering.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). The commit
type maps to the package or area you touched:

```
feat(core): editable edges with draggable spline control points
fix(react): re-cull on zoom so a zoomed-in overview drops off-screen nodes
docs: mark dynamic-grouping and editable-edge gaps closed
chore(release): mark scoped packages public for npm publish
```

Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`.
Keep commits focused; do not include unrelated changes. No AI/tool attribution
in commit messages.

## Pull request checklist

Before you open a PR, make sure:

- [ ] `npm run build` (+ `-w @realflow/compat` if you touched it) succeeds
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes, and you added/updated tests for your change
- [ ] Docs / `CHANGELOG.md` / `API_STABILITY.md` updated if behavior or public API changed
- [ ] The PR description explains **what** changed and **why**, with a reproduction or benchmark where relevant

CI runs lint, typecheck, unit tests, package build, a native-ESM load check, the
cross-browser E2E matrix and visual-regression snapshots. Green CI is required
before review.

## Reporting security issues

Please **do not** open a public issue for security vulnerabilities. Follow the
process in [SECURITY.md](./SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE) that covers the project.
