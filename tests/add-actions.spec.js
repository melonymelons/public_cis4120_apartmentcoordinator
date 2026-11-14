import { test, expect } from './fixtures';
import { enterEdit } from './layout-helpers';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
const nav = page => page.getByRole('navigation', { name: 'Mobile navigation' });

test('task and item creation is available where relevant, with Inventory restricted to items', async ({ page }) => {
  await page.goto('/'); await enterEdit(page);
  await expect(page.getByRole('button', { name: 'Add task', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add item', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add object', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  for (const tab of ['To-dos', 'Inventory']) {
    await nav(page).getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add task', exact: true })).toHaveCount(tab === 'To-dos' ? 1 : 0);
    await expect(page.getByRole('button', { name: 'Add item', exact: true })).toHaveCount(tab === 'Inventory' ? 1 : 0);
  }
  await nav(page).getByRole('button', { name: 'Apartment', exact: true }).click();
  await page.getByRole('button', { name: 'Open Bathroom', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(dialog.getByLabel('Task name')).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Room', exact: true })).toHaveText('Bathroom');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await dialog.getByRole('button', { name: 'Add item', exact: true }).click();
  await expect(dialog.getByLabel('Room', { exact: true })).toContainText('Bathroom');
});

test('To-dos creates task work while Inventory creates only supplies', async ({ page }) => {
  await page.goto('/');
  const before = await saved(page);
  await nav(page).getByRole('button', { name: 'To-dos', exact: true }).click();
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task name').fill('Clean the sink');
  await dialog.getByRole('button', { name: 'Add to apartment' }).click();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  const afterTask = await saved(page);
  expect(afterTask.tasks.find(t => t.title === 'Clean the sink')).toMatchObject({ status: 'open', from: before.currentUser, to: null });
  expect(afterTask.inventory).toEqual(before.inventory);
  await nav(page).getByRole('button', { name: 'To-dos', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Clean the sink' })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await dialog.getByLabel('Item name').fill('Sponges');
  await dialog.getByLabel('Quantity (optional)').fill('4');
  await dialog.getByRole('button', { name: 'Add item', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  const afterItem = await saved(page);
  expect(afterItem.inventory.find(i => i.name === 'Sponges')).toMatchObject({ quantity: 4 });
  expect(afterItem.tasks).toEqual(afterTask.tasks);
  await nav(page).getByRole('button', { name: 'Inventory', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Sponges' })).toBeVisible();
});

test('items added during layout editing are discarded by Cancel and committed by Done', async ({ page }) => {
  await page.goto('/');
  const before = await saved(page);
  for (const commit of [false, true]) {
    await enterEdit(page);
    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Item name').fill('Paper towels');
    await dialog.getByLabel('Room', { exact: true }).click();
    await dialog.getByRole('option', { name: 'Kitchen', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add item', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    expect((await saved(page)).inventory).toEqual(before.inventory);
    await page.getByRole('button', { name: commit ? 'Done' : 'Cancel', exact: true }).click();
    expect((await saved(page)).inventory.some(i => i.name === 'Paper towels')).toBe(commit);
  }
});
