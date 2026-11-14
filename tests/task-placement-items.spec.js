import { test, expect } from './fixtures';
import { initialState } from '../src/model';

for (const width of [390, 1280]) test(`task placement shows existing room items and task states at ${width}px`, async ({ page }) => {
  const state = initialState();
  state.inventory = state.inventory.map(item => item.id === 'stock-paper' ? { ...item, x: 27, y: 70, quantity: 8, status: 'in' } : item);
  await page.setViewportSize({ width, height: 956 });
  await page.addInitScript(value => localStorage.setItem('roomie-v1', JSON.stringify(value)), state);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Bathroom', exact: true }).click({ position: { x: 8, y: 8 } });
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add to apartment' }).click();
  const preview = dialog.locator('.object-placement-preview');
  const item = preview.locator('[data-item="stock-paper"]');
  await expect(item).toBeVisible();
  await expect(item.locator('.supply-map-count')).toHaveText('8');
  expect(await item.evaluate(el => [parseFloat(el.style.left), parseFloat(el.style.top)])).toEqual([27, 70]);
  await expect(preview.locator('[data-object="supplies1"]')).toHaveClass(/needs-attention/);
  await expect(preview.locator('[data-item="stock-bags"]')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /Position/ })).toBeEnabled();
  await dialog.evaluate(async el => { await Promise.allSettled(el.getAnimations().map(a => a.finished)); });
  await page.screenshot({ path: `test-results/task-placement-with-items-${width}.png` });
});

test('task placement includes items added in the current layout draft', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit apartment' }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Item name').fill('Draft tissues');
  await dialog.getByLabel('Quantity (optional)').fill('4');
  await dialog.getByRole('button', { name: 'Add item', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add to apartment' }).click();
  await expect(dialog.locator('.object-placement-preview .supply-map-pin').filter({ hasText: '4' })).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).inventory.some(item => item.name === 'Draft tissues'))).toBe(false);
});
