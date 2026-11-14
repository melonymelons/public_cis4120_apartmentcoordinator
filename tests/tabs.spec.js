import { test, expect, setFixtureUser } from './fixtures';
import { initialState } from '../src/model.js';

const nav = page => page.getByRole('navigation', { name: 'Mobile navigation' });

test('inventory quantities persist across reloads without task actions', async ({ page }) => {
  await page.goto('/');
  await nav(page).getByRole('button', { name: 'Inventory' }).click();
  const bags = page.getByRole('article', { name: 'Trash bags', exact: true });
  await bags.getByRole('button', { name: 'Edit Trash bags' }).click();
  await page.getByRole('dialog').getByLabel('Quantity (optional)').fill('5');
  await page.getByRole('dialog').getByRole('button', { name: 'Save item' }).click();
  await expect(bags.getByText('In stock', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add task', exact: true })).toHaveCount(0);
  await setFixtureUser(page, 'maya');
  await nav(page).getByRole('button', { name: 'Inventory', exact: true }).click();
  await expect(bags.getByRole('button', { name: /Restock|View task/ })).toHaveCount(0);
  await expect(bags.getByRole('status')).toHaveText('5 items');
  await page.screenshot({ path: 'test-results/inventory-page.png', fullPage: true });
});

test('add, filter, edit and remove a shared supply', async ({ page }) => {
  await page.goto('/');
  await nav(page).getByRole('button', { name: 'Inventory' }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Item name').fill('Paper towels');
  await expect(dialog.getByLabel('Stock level', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Quantity (optional)').fill('1');
  await dialog.getByLabel('Room', { exact: true }).click();
  await dialog.getByRole('option', { name: 'Kitchen', exact: true }).click();
  await expect(dialog.getByLabel('Map object (optional)')).toHaveCount(0);
  await dialog.getByLabel('Notes (optional)').fill('Top cabinet');
  await dialog.getByRole('button', { name: 'Add item', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByLabel('Search supplies').fill('Paper towels');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByLabel('Filter inventory by room').click();
  await page.getByRole('option', { name: 'Bathroom', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByLabel('Filter inventory by room').click();
  await page.getByRole('option', { name: 'All rooms', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Paper towels' }).click();
  await dialog.getByLabel('Item name').fill('Kitchen roll');
  await dialog.getByRole('button', { name: 'Save item' }).click();
  await page.getByLabel('Search supplies').fill('Kitchen roll');
  await expect(page.getByRole('button', { name: 'Open Trash for Kitchen roll' })).toHaveCount(0);
  await page.reload();
  await nav(page).getByRole('button', { name: 'Inventory' }).click();
  await page.getByRole('button', { name: 'Edit Kitchen roll' }).click();
  await expect(dialog.getByLabel('Notes (optional)')).toHaveValue('Top cabinet');
  await dialog.getByRole('button', { name: 'Remove item' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, remove' }).click();
  await expect(page.getByRole('article', { name: 'Kitchen roll', exact: true })).toHaveCount(0);
});

test('room deletion preserves supplies while clearing removed map links', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit apartment' }).click();
  await page.getByRole('button', { name: 'Delete Kitchen', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await nav(page).getByRole('button', { name: 'Inventory' }).click();
  const bags = page.getByRole('article', { name: 'Trash bags', exact: true });
  await expect(bags).toBeVisible();
  await expect(bags.getByRole('button', { name: 'Open Trash for Trash bags' })).toHaveCount(0);
  await bags.getByRole('button', { name: 'Edit Trash bags' }).click();
  await expect(page.getByRole('dialog').getByLabel('Room', { exact: true })).toContainText('Living room');
  await expect(page.getByRole('dialog').getByLabel('Map object (optional)')).toHaveCount(0);
});

test('schedule saves precise times and shares them with the trays', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T18:00:00Z') });
  await page.goto('/');
  await nav(page).getByRole('button', { name: 'Schedule' }).click();
  await expect(page.getByLabel('Schedule date')).toHaveValue('2026-11-02');
  await page.getByLabel('Start time').fill('12:00');
  await page.getByLabel('End time').fill('15:00');
  await page.getByRole('button', { name: 'Save availability' }).click();
  await expect(page.locator('.schedule-saved-windows')).toContainText('12:00 pm – 3:00 pm');
  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page.locator('.schedule-saved-windows')).toHaveCount(0);
  await nav(page).getByRole('button', { name: 'Apartment', exact: true }).click();
  await page.getByRole('button', { name: 'Expand availability', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Jessalyn, Free', exact: true })).toBeVisible();
  await page.reload();
  await nav(page).getByRole('button', { name: 'Schedule' }).click();
  await expect(page.locator('.schedule-saved-windows')).toContainText('12:00 pm – 3:00 pm');
});

test('older saved apartments start with an empty inventory', async ({ page }) => {
  const seed = initialState();
  delete seed.inventory;
  await page.addInitScript(state => localStorage.setItem('roomie-v1', JSON.stringify(state)), seed);
  await page.goto('/');
  await nav(page).getByRole('button', { name: 'Inventory' }).click();
  await expect(page.getByRole('button', { name: 'Add item', exact: true })).toBeVisible();
});

test('five-tab navigation and new pages fit narrow phone screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const tab of ['Inventory', 'Schedule', 'To-dos', 'Apartment', 'Profile']) {
    await nav(page).getByRole('button', { name: tab, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(nav(page).getByRole('button', { name: tab, exact: true })).toBeInViewport();
  }
});
