import { test, expect } from './fixtures';

const zoom = page => page.locator('.map-camera').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);

test('trackpad zoom reaches 25%, keeps the grid covering the canvas, and resets with Home', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('.map-viewport');
  await canvas.dispatchEvent('wheel', { ctrlKey: true, deltaY: 1500, clientX: 195, clientY: 300 });
  await expect.poll(() => zoom(page)).toBe(.25);
  await canvas.dispatchEvent('wheel', { deltaX: 500, deltaY: 500 });
  const grid = await page.locator('.canvas-grid').boundingBox();
  const viewport = await canvas.boundingBox();
  expect(grid.x).toBeLessThanOrEqual(viewport.x);
  expect(grid.y).toBeLessThanOrEqual(viewport.y);
  expect(grid.x + grid.width).toBeGreaterThanOrEqual(viewport.x + viewport.width);
  expect(grid.y + grid.height).toBeGreaterThanOrEqual(viewport.y + viewport.height);
  await expect(page.locator('.map-viewport .map-canvas')).toHaveCount(1);
  await canvas.focus();
  await page.keyboard.press('Home');
  expect(await zoom(page)).toBe(1);
  await canvas.dispatchEvent('wheel', { ctrlKey: true, deltaY: -1500, clientX: 195, clientY: 300 });
  await expect.poll(() => zoom(page)).toBe(3);
});

test.describe('touch zoom out', () => {
  test.use({ hasTouch: true });
  test('pinching inward shrinks the apartment below its starting size', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const box = await page.locator('.map-camera').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height * .75;
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 100, y, id: 1 }, { x: x + 100, y, id: 2 }] });
    for (let i = 1; i <= 8; i++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 100 + i * 11, y, id: 1 }, { x: x + 100 - i * 11, y, id: 2 }] });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await zoom(page)).toBe(.25);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
