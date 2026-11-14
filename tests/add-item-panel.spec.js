import { test, expect } from './fixtures';
import { initialState } from '../src/model';

for (const width of [320, 440, 1280]) test(`Add item is compact with custom controls at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  // Desktop and mobile navigation expose the same page buttons.
  await page.locator(width > 640 ? '.desktop-nav' : '.mobile-nav').getByRole('button', { name: 'Inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Add item', exact: true })).toBeVisible();
  await expect(dialog.locator('select')).toHaveCount(0);
  await expect(dialog.getByLabel('Map object (optional)')).toHaveCount(0);
  await expect(dialog.getByLabel('Notes (optional)')).toBeVisible();
  await dialog.getByLabel('Item name').fill('Hand soap');
  await expect(dialog.locator('details,summary')).toHaveCount(0);
  await dialog.getByLabel('Room', { exact: true }).click();
  await expect(dialog.getByRole('option', { name: 'Shared / no room' })).toHaveCount(0);
  await dialog.getByRole('option', { name: 'Bathroom', exact: true }).click();
  await dialog.getByLabel('Quantity (optional)').fill('1');
  await dialog.getByLabel('Unit', { exact: true }).fill('bottles');
  await expect(dialog.getByRole('status')).toHaveText('Running low');
  await dialog.evaluate(async el => { await Promise.allSettled(el.getAnimations().map(a => a.finished)); });
  await page.screenshot({ path: `test-results/add-item-panel-${width}.png` });
  expect((await dialog.boundingBox()).height).toBeLessThanOrEqual(868);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByLabel('Storage spot (optional)').fill('Under the sink');
  await dialog.getByRole('button', { name: 'Add item', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).inventory.find(i => i.name === 'Hand soap'));
  expect(saved).toMatchObject({ roomId: 'bathroom', quantity: 1, unit: 'bottles', status: 'low', storage: 'Under the sink' });
});


test('an item cannot be saved when the apartment has no rooms', async ({ page }) => {
  const state = initialState();
  state.rooms = []; state.objects = []; state.tasks = []; state.inventory = [];
  await page.addInitScript(value => localStorage.setItem('roomie-v1', JSON.stringify(value)), state);
  await page.goto('/');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Item name').fill('Soap');
  await expect(dialog.getByText('Add a room before adding an item.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Add item', exact: true })).toBeDisabled();
});
