import { test, expect } from './fixtures';

const paintedRooms = page => page.locator('.map-camera .pixel-room-scene').evaluateAll(canvases => canvases.length === 5 && canvases.every(canvas => {
  if (canvas.dataset.painted !== 'true') return false;
  const ctx = canvas.getContext('2d');
  return ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3] > 0;
}));

test('cold mobile artwork paints without switching tabs, and repaints after context restoration', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/pixel/*.webp', async route => {
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.goto('/');
  await expect.poll(() => paintedRooms(page)).toBe(true);
  await page.locator('.map-camera .pixel-room-scene').evaluateAll(canvases => canvases.forEach(canvas => {
    canvas.width = canvas.width;
    canvas.dispatchEvent(new Event('contextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('contextrestored'));
  }));
  await expect.poll(() => paintedRooms(page)).toBe(true);
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 440]) test(`schedule date arrows stay outside the date field at ${width}px`, async ({ page, browserName }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Schedule', exact: true }).click();
  const times = page.locator('.availability-time-inputs');
  const start = await page.getByLabel('Start time').boundingBox(), end = await page.getByLabel('End time').boundingBox(), row = await times.boundingBox();
  expect(start.x).toBeCloseTo(row.x, 0);
  expect(end.x + end.width).toBeLessThanOrEqual(row.x + row.width + 1);
  expect(start.width).toBeCloseTo(end.width, 0);
  expect(start.x + start.width).toBeLessThanOrEqual(end.x - 8);
  await page.getByLabel('Start time').fill('14:00');
  await page.getByLabel('End time').fill('16:00');
  await page.screenshot({ path: `test-results/schedule-times-${browserName}-${width}.png` });
  const input = page.getByLabel('Schedule date', { exact: true });
  const before = await input.inputValue();
  const previous = page.getByRole('button', { name: 'Previous day' });
  const next = page.getByRole('button', { name: 'Next day' });
  const a = await previous.boundingBox(), b = await input.boundingBox(), c = await next.boundingBox();
  expect(a.x + a.width).toBeLessThanOrEqual(b.x - 4);
  expect(b.x + b.width).toBeLessThanOrEqual(c.x - 4);
  await next.tap();
  await expect(input).not.toHaveValue(before);
  await previous.tap();
  await expect(input).toHaveValue(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
