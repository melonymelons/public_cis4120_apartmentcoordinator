import { test, expect } from './fixtures';
import { initialState } from '../src/model';

async function seedRestock(page) {
  const state = initialState();
  state.tasks[1] = { ...state.tasks[1], inventoryId: 'stock-paper', status: 'assigned', to: 'jess' };
  state.inventory[1] = { ...state.inventory[1], quantity: 3, unit: 'rolls', status: 'in' };
  await page.addInitScript(value => { if (!localStorage.getItem('roomie-v1')) localStorage.setItem('roomie-v1', JSON.stringify(value)); }, state);
  await page.goto('/');
}

test('restock actions share a row; quantity is required and Back does not complete the task', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await seedRestock(page);
  await page.locator('[data-object="supplies1"]').click();
  const dialog = page.getByRole('dialog');
  const complete = dialog.getByRole('button', { name: 'Mark complete' });
  const remove = dialog.getByRole('button', { name: 'Remove', exact: true });
  await expect(remove).toHaveCount(1);
  const a = await complete.boundingBox(), b = await remove.boundingBox();
  expect(Math.abs(a.y - b.y)).toBeLessThan(1);
  await complete.click();
  await expect(dialog.getByRole('heading', { name: 'How many did you restock?' })).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Confirm restock' });
  await expect(confirm).toBeDisabled();
  for (const invalid of ['0', '-1', '1.5', '99999']) {
    await dialog.getByLabel('Quantity restocked').fill(invalid);
    await expect(confirm).toBeDisabled();
  }
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(complete).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).inventory.find(i => i.id === 'stock-paper').quantity)).toBe(3);
  await complete.click();
  await dialog.getByLabel('Quantity restocked').fill('4');
  await expect(dialog.getByRole('status').filter({ hasText: 'After restock' })).toHaveText('After restock: 7 rolls');
  await dialog.evaluate(async el => { await Promise.allSettled(el.getAnimations().map(a => a.finished)); });
  await page.screenshot({ path: 'test-results/restock-quantity-320.png' });
  await confirm.click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).inventory.find(i => i.id === 'stock-paper').quantity)).toBe(7);
});

test('Remove deletes only the restock task and leaves stock unchanged, including shared task markers', async ({ page }) => {
  await seedRestock(page);
  await page.locator('[data-object="supplies1"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByRole('heading', { name: 'Remove restock task?' })).toBeVisible();
  await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  expect(state.tasks.some(task => task.id === 'task-supplies')).toBe(false);
  expect(state.tasks.some(task => task.id === 'task-trash')).toBe(true);
  expect(state.inventory.find(item => item.id === 'stock-paper').quantity).toBe(3);
});

test('completing from To-dos also prompts for the restocked amount', async ({ page }) => {
  await seedRestock(page);
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'To-dos', exact: true }).click();
  await page.getByRole('button', { name: 'Complete task: Restock toilet paper' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Quantity restocked').fill('2');
  await dialog.getByRole('button', { name: 'Confirm restock' }).click();
  await expect(dialog).toHaveCount(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  expect(state.inventory.find(item => item.id === 'stock-paper').quantity).toBe(5);
  expect(state.tasks.some(task => task.id === 'task-supplies')).toBe(false);
});
