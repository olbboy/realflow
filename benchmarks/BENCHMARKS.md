# RealFlow vs React Flow — head-to-head benchmark

Chromium (Playwright, **software rendering** — no GPU) · 1440×900 · production builds · deterministic identical scenes.
Reproduce: `npm run bench -w realflow-benchmarks`.

> Absolute FPS is capped by software rendering (CI has no GPU); on real hardware
> both libraries are far smoother. The **relative** comparison is the signal.
> Every row's pan is verified to actually move the viewport (no frozen-canvas
> false 60fps — an easy benchmark trap).

## Overview scenario — all nodes visible (fit to screen)

Worst case: every node is genuinely on-screen, so culling cannot help either library. This is a raw paint stress test.

| Nodes | Library | Pan FPS | DOM nodes | Mount ms | Heap MB |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1000 | RealFlow | **37** | 1000 | 6903 | 14 |
| 1000 | React Flow (default) | **35** | 1000 | 6977 | 28 |
| 1000 | React Flow (onlyRenderVisible) | **30** | 1000 | 7001 | 25 |
| 5000 | RealFlow | **8** | 5000 | 8182 | 58 |
| 5000 | React Flow (default) | **6** | 5000 | 9039 | 122 |
| 5000 | React Flow (onlyRenderVisible) | **5** | 5000 | 8745 | 109 |
| 10000 | RealFlow | **4** | 10000 | 9625 | 112 |
| 10000 | React Flow (default) | **3** | 10000 | 11927 | 239 |
| 10000 | React Flow (onlyRenderVisible) | **3** | 10000 | 11619 | 214 |

## Editing scenario — zoomed to 1:1 (a viewport-worth of nodes visible)

The realistic authoring case. RealFlow culls off-screen nodes by default; React Flow renders all unless `onlyRenderVisibleElements` is set.

| Nodes | Library | Pan FPS | DOM nodes | Mount ms | Heap MB |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1000 | RealFlow | **53** | 143 | 8428 | 6 |
| 1000 | React Flow (default) | **49** | 1000 | 8475 | 28 |
| 1000 | React Flow (onlyRenderVisible) | **49** | 49 | 8519 | 9 |
| 5000 | RealFlow | **48** | 143 | 11139 | 12 |
| 5000 | React Flow (default) | **8** | 5000 | 10390 | 122 |
| 5000 | React Flow (onlyRenderVisible) | **14** | 49 | 10400 | 20 |
| 10000 | RealFlow | **43** | 143 | 21099 | 18 |
| 10000 | React Flow (default) | **4** | 10000 | 13721 | 239 |
| 10000 | React Flow (onlyRenderVisible) | **9** | 49 | 12778 | 34 |

Higher FPS is better; lower DOM nodes / mount ms / heap is better.
