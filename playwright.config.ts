import { defineConfig, devices } from '@playwright/test';

// Cross-browser + touch E2E matrix for ReFlow. Drives the production build of
// the demo app (examples/demo) through a real browser on Chromium, Firefox,
// WebKit, and a mobile (touch) profile. One command: `npm run test:e2e`.
const PORT = Number(process.env.E2E_PORT ?? 4318);

export default defineConfig({
  testDir: './e2e',
  // Interactions mutate shared viewport state; keep each file serial per worker.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    // Screenshots freeze CSS animations and tolerate tiny AA/subpixel noise.
    // Baselines are platform-pinned (Playwright suffixes them per-OS).
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    // Functional matrix — runs everything EXCEPT the visual snapshots (those
    // are engine/OS specific and belong to a single pinned project).
    { name: 'chromium', testIgnore: '**/visual.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testIgnore: '**/visual.spec.ts', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testIgnore: '**/visual.spec.ts', use: { ...devices['Desktop Safari'] } },
    // Touch matrix — mobile Safari emulation (hasTouch + isMobile).
    { name: 'mobile-webkit', testIgnore: '**/visual.spec.ts', use: { ...devices['iPhone 13'] } },
    // Visual regression — Chromium only, its own baselines.
    { name: 'visual', testMatch: '**/visual.spec.ts', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run preview -w reflow-demo -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
