import { test, expect } from './fixtures';

test('Remove sits next to Flag for attention without divider lines', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Dishes in Kitchen, all good', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); });
  const flag = await dialog.getByRole('button', { name: 'Flag for attention' }).boundingBox();
  const remove = await dialog.getByRole('button', { name: 'Remove', exact: true }).boundingBox();
  expect(remove.y).toBeCloseTo(flag.y, 0);
  await expect(dialog.locator('.object-summary')).toHaveCSS('border-bottom-width', '0px');
  await expect(dialog.locator('.add-object-task')).toHaveCSS('border-top-width', '0px');
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Remove object?' })).toBeVisible();
});

test('green assigned tasks have no editing controls and a single Remove button', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trash in Kitchen, needs attention', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'I’ll take this', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Mark complete', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: /Edit|Delete|Add task|Add item/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Remove object?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Mark complete', exact: true })).toBeVisible();
});

for (const width of [320, 390]) test(`task detail layout at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Trash in Kitchen, needs attention', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); });
  await dialog.screenshot({ path: `test-results/task-panel-${width}.png` });
  expect(await dialog.locator('.modal-body').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const actions = await dialog.locator('.stack-actions').boundingBox();
  await expect(dialog.locator('.add-actions')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Add task', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Add item', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Edit task', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Delete task', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(1);
  const remove = await dialog.getByRole('button', { name: 'Remove', exact: true }).boundingBox();
  expect(remove.y - (actions.y + actions.height)).toBeGreaterThanOrEqual(12);
  const bounds = await dialog.boundingBox();
  expect(bounds.y + bounds.height - (remove.y + remove.height)).toBeLessThan(40);
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Remove object?' })).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Remove', exact: true })).toBeVisible();
});

test('opening an object from an enlarged room keeps the task panel compact', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Kitchen', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Trash in Kitchen, needs attention', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); });
  expect((await dialog.boundingBox()).width).toBeLessThanOrEqual(450);
  await expect(dialog.getByRole('heading', { name: 'Take out the trash', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Add item', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog.getByRole('button', { name: 'Add item', exact: true })).toBeVisible();
});

test('removal confirmation supports Cancel and Escape, then removes only after confirmation', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  await page.getByRole('button', { name: 'Trash in Kitchen, needs attention', exact: true }).click();
  const panel = page.getByRole('dialog');
  const confirm = page.getByRole('alertdialog', { name: 'Remove object?' });
  await panel.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(confirm.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await expect(confirm).toContainText('Its tasks will also be removed.');
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await panel.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')))).toEqual(before);
  await panel.getByRole('button', { name: 'Remove', exact: true }).click();
  await confirm.screenshot({ path: 'test-results/remove-confirmation.png' });
  await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(panel).toHaveCount(0);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  expect(after.objects.some(o => o.id === 'trash1')).toBe(false);
  expect(after.tasks.some(t => t.objectId === 'trash1')).toBe(false);
  expect(after.inventory.find(i => i.id === 'stock-bags').objectId).toBeNull();
  expect(after.inventory.length).toBe(before.inventory.length);
});
