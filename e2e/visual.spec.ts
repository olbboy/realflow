import { test, expect, type Page } from '@playwright/test';

// Visual regression — Chromium only, its own baselines (see the `visual`
// project in playwright.config.ts). Animations are frozen and the moving
// bits (FPS meter, MiniMap canvas) are masked so snapshots are deterministic.
// Update baselines intentionally with: npm run test:e2e:visual -- --update-snapshots

async function settleScene(page: Page) {
  // Wait for the fitView entrance animation to finish.
  await page.waitForTimeout(900);
}

function masks(page: Page) {
  return [page.locator('.demo-fps'), page.locator('.rf-minimap')];
}

test('showcase scene', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.rf-node').first()).toBeVisible();
  await settleScene(page);
  await expect(page).toHaveScreenshot('showcase.png', { mask: masks(page) });
});

test('UI frameworks scene (light)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'UI frameworks' }).click();
  await expect(page.locator('.rf-node[data-id="svc-api"]')).toBeVisible();
  await settleScene(page);
  await expect(page).toHaveScreenshot('framework-light.png', { mask: masks(page) });
});

test('UI frameworks scene (dark)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'UI frameworks' }).click();
  await page.locator('.demo-actions button').click(); // toggle dark
  await expect(page.locator('.rf-node[data-id="svc-api"]')).toBeVisible();
  await settleScene(page);
  await expect(page).toHaveScreenshot('framework-dark.png', { mask: masks(page) });
});

test('smart routing scene', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Smart routing' }).click();
  await expect(page.locator('.rf-node').first()).toBeVisible();
  await settleScene(page);
  await expect(page).toHaveScreenshot('routing.png', { mask: masks(page) });
});
