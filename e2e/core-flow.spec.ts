import { test, expect, type Page } from '@playwright/test';

// Real, assertion-based E2E against the production demo build. Runs on the
// full browser matrix (Chromium / Firefox / WebKit) plus a mobile-touch
// profile. Replaces the old fire-and-forget console.log smoke script.

const nodeSel = (id: string) => `.rf-node[data-id="${id}"]`;

async function gotoShowcase(page: Page) {
  await page.goto('/');
  // The showcase tab is the default scene; wait for its nodes to paint.
  await expect(page.locator(nodeSel('notify'))).toBeVisible();
}

async function center(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no bounding box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

test.describe('ReFlow core interactions', () => {
  test('renders the showcase graph', async ({ page }) => {
    await gotoShowcase(page);
    // Seven showcase nodes + their edges should be in the DOM.
    expect(await page.locator('.rf-node').count()).toBeGreaterThanOrEqual(5);
    expect(await page.locator('.rf-edge').count()).toBeGreaterThanOrEqual(5);
    // Named nodes exist.
    for (const id of ['trigger', 'enrich', 'review', 'notify']) {
      await expect(page.locator(nodeSel(id))).toBeVisible();
    }
  });

  test('dragging a node moves it', async ({ page }, testInfo) => {
    test.skip(!!testInfo.project.use.isMobile, 'mouse-drag; touch is covered separately');
    await gotoShowcase(page);
    const start = await center(page, nodeSel('notify'));
    // Grab near the top of the node (away from handles) and drag.
    await page.mouse.move(start.x, start.box.y + 14);
    await page.mouse.down();
    await page.mouse.move(start.x + 90, start.box.y + 14 + 110, { steps: 16 });
    await page.mouse.up();

    const end = await page.locator(nodeSel('notify')).boundingBox();
    expect(end).not.toBeNull();
    // Alignment snapping can nudge the exact delta, so assert meaningful motion,
    // not an exact pixel count.
    expect(end!.x - start.box.x).toBeGreaterThan(30);
    expect(end!.y - start.box.y).toBeGreaterThan(30);
  });

  test('undo restores a dragged node', async ({ page }, testInfo) => {
    test.skip(!!testInfo.project.use.isMobile, 'keyboard undo is desktop-only here');
    await gotoShowcase(page);
    const start = await center(page, nodeSel('notify'));
    await page.mouse.move(start.x, start.box.y + 14);
    await page.mouse.down();
    await page.mouse.move(start.x + 90, start.box.y + 120, { steps: 12 });
    await page.mouse.up();
    const moved = await page.locator(nodeSel('notify')).boundingBox();
    expect(moved!.x - start.box.x).toBeGreaterThan(30);

    await page.keyboard.press('ControlOrMeta+z');
    const restored = await page.locator(nodeSel('notify')).boundingBox();
    // Back within a couple of pixels of where it started.
    expect(Math.abs(restored!.x - start.box.x)).toBeLessThan(12);
    expect(Math.abs(restored!.y - start.box.y)).toBeLessThan(12);
  });

  test('dragging between handles creates an edge', async ({ page }, testInfo) => {
    test.skip(!!testInfo.project.use.isMobile, 'handle-drag connect is a desktop interaction');
    await gotoShowcase(page);
    const before = await page.locator('.rf-edge').count();
    const src = await center(page, `${nodeSel('enrich')} .rf-handle-right`);
    const tgt = await center(page, `${nodeSel('review')} .rf-handle-left`);
    // WebKit is timing-sensitive here: hover the source handle, press, step off
    // it to start the connection, approach in small steps, settle on the target
    // handle, then release. Fewer/larger jumps intermittently miss the target.
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move(src.x + 14, src.y, { steps: 5 });
    await page.mouse.move((src.x + tgt.x) / 2, (src.y + tgt.y) / 2, { steps: 14 });
    await page.mouse.move(tgt.x, tgt.y, { steps: 14 });
    await page.mouse.move(tgt.x, tgt.y); // settle precisely on the target handle
    await page.mouse.up();
    await expect
      .poll(() => page.locator('.rf-edge').count(), { timeout: 5000 })
      .toBe(before + 1);
  });

  test('culls off-screen nodes at 10k (DOM stays small)', async ({ page }) => {
    await gotoShowcase(page);
    await page.getByRole('button', { name: '10k nodes' }).click();
    // Let the stress scene mount + fitView settle.
    await expect.poll(() => page.locator('.rf-node').count(), { timeout: 15_000 }).toBeGreaterThan(0);
    const domNodes = await page.locator('.rf-node').count();
    // 10k nodes in the graph, but culling keeps the mounted count far lower.
    expect(domNodes).toBeLessThan(3000);
  });
});

test.describe('touch', () => {
  test('tap selects a node on a touch device', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.isMobile, 'touch-only');
    await gotoShowcase(page);
    await page.locator(nodeSel('notify')).tap();
    await expect(page.locator(`${nodeSel('notify')}.rf-selected`)).toBeVisible();
  });
});
