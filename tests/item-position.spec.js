import { test, expect } from './fixtures';
import { initialState } from '../src/model';

for (const width of [390, 1280]) test(`items use the same room position on the apartment and enlarged view at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = initialState();
  state.inventory = state.inventory.map(item => item.id === 'stock-paper' ? { ...item, quantity: 8, unit: 'rolls', status: 'in', x: 28, y: 78 } : item);
  await page.addInitScript(value => { if (!localStorage.getItem('roomie-v1')) localStorage.setItem('roomie-v1', JSON.stringify(value)); }, state);
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const room = page.locator('.map-page .map-room[data-room="bathroom"]');
  const pin = room.locator('[data-item="stock-paper"]');
  await expect(pin).toBeVisible();
  await expect(page.locator('.room-stock-alert')).toHaveCount(0);
  expect(await pin.evaluate(el => [parseFloat(el.style.left), parseFloat(el.style.top)])).toEqual([28, 78]);
  async function relativePosition(marker, parent) {
    const m = await marker.boundingBox(), r = await parent.boundingBox();
    return { x: (m.x + m.width / 2 - r.x) / r.width, y: (m.y + m.height - r.y) / r.height };
  }
  const before = await relativePosition(pin, room);
  await page.screenshot({ path: `test-results/item-map-position-${width}.png` });
  await page.getByRole('button', { name: 'Open Bathroom', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); });
  const enlarged = dialog.locator('[data-item="stock-paper"]');
  expect(await enlarged.evaluate(el => [parseFloat(el.style.left), parseFloat(el.style.top)])).toEqual([28, 78]);
  const after = await relativePosition(enlarged, dialog.locator('.map-room[data-room="bathroom"]'));
  expect(after.x).toBeCloseTo(before.x, 1);
  expect(after.y).toBeCloseTo(before.y, 1);
  await expect(dialog.getByRole('button', { name: 'Use one Toilet paper' })).toHaveCount(0);
  await expect(enlarged).not.toHaveAttribute('title', 'Drag to reposition');
  await expect(dialog.locator('.supply-position-grip')).toHaveCount(0);
  await enlarged.click();
  await expect(dialog.getByRole('heading', { name: 'Toilet paper', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Use one Toilet paper' }).click();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(pin).toContainText('7');
  expect(await pin.evaluate(el => [parseFloat(el.style.left), parseFloat(el.style.top)])).toEqual([28, 78]);
  await page.reload();
  await expect(pin).toBeVisible();
  expect(await pin.evaluate(el => [parseFloat(el.style.left), parseFloat(el.style.top)])).toEqual([28, 78]);
});
