# Security Policy

## Supported versions

RealFlow is pre-1.0. Security fixes land on the latest published `0.x` release
of each package (`@realflow/core`, `@realflow/react`, `@realflow/compat`).

| Version | Supported |
| --- | --- |
| latest `0.x` | ✅ |
| older `0.x`  | ❌ (please upgrade) |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, use one of these private channels:

1. **GitHub Security Advisories** (preferred) — open a private report at
   [github.com/olbboy/realflow/security/advisories/new](https://github.com/olbboy/realflow/security/advisories/new).
2. **Email** — send details to **minhdatplus@gmail.com** with `SECURITY` in the
   subject line.

Please include, as far as you can:

- the affected package and version,
- a description of the vulnerability and its impact,
- steps to reproduce or a proof-of-concept,
- any suggested mitigation.

## What to expect

- **Acknowledgement** within 5 business days.
- An assessment and, if confirmed, a plan and timeline for a fix.
- Credit in the release notes when the fix ships, unless you prefer to remain
  anonymous.

Please give us a reasonable window to release a fix before any public
disclosure. We follow coordinated disclosure and will keep you updated
throughout.

## Scope

RealFlow is a client-side rendering library and a headless graph engine. The
most relevant classes of issue are:

- **Untrusted graph input** — `@realflow/core` is designed to validate and
  sanitize operations (e.g. `applyOperations` never throws and clamps numeric
  input; the spatial index rejects pathological rects). A crafted graph or
  operation batch that causes a crash, hang, or unbounded resource use is
  in scope.
- **XSS via rendered content** — if custom node/edge data can be made to inject
  script through a RealFlow-provided code path (rather than a consumer's own
  `dangerouslySetInnerHTML`), that is in scope.
- **Prototype pollution / ReDoS** in the core engine.

Out of scope: vulnerabilities in example apps under `examples/`, in third-party
dependencies of the demo (report those upstream), or issues that require a
consumer to deliberately render untrusted HTML themselves.
