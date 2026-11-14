import { test, expect } from '@playwright/test';

test('the map loader starts after the app opens and completes before revealing the map', async ({ page }) => {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route('**/src/main.jsx', async route => { await ready; await route.continue(); });
  await page.goto('/', { waitUntil: 'commit' });
  const loading = page.locator('.nest-loading');
  const bar = page.getByRole('progressbar', { name: 'Loading nest' });
  await expect(bar).toHaveCount(0);
  release();
  await expect(bar).toBeVisible();
  await expect(page.getByAltText('loading...', { exact: true })).toBeVisible();
  const label = await page.getByAltText('loading...', { exact: true }).boundingBox();
  expect(await loading.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(227, 232, 215)');
  expect(await page.locator('.nest-loading-fill').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(220, 161, 176)');
  const bounds = await bar.boundingBox(), viewport = page.viewportSize();
  expect(label.y + label.height).toBeLessThan(bounds.y);
  expect(bounds.x + bounds.width / 2).toBeCloseTo(viewport.width / 2, 1);
  expect(bounds.y + bounds.height / 2).toBeCloseTo(viewport.height / 2, 1);
  await page.screenshot({ path: 'test-results/loading-screen.png' });
  await expect.poll(() => loading.evaluateAll(nodes => nodes[0]?.dataset.complete), { timeout: 8000, intervals: [20] }).toBe('true');
  await expect(page.getByRole('button', { name: 'Edit apartment' })).toHaveCount(0);
  await expect.poll(() => page.locator('.nest-loading-fill').evaluate(el => getComputedStyle(el).clipPath), { intervals: [20] }).toBe('inset(0px)');
  await expect(page.getByRole('button', { name: 'Edit apartment' })).toBeVisible({ timeout: 8000 });
  await expect(loading).toHaveCount(0);
});
