import { enterEdit } from './layout-helpers';
import { test, expect } from './fixtures';

async function pickup(page) {
  const pin = page.getByRole('button', { name: 'Trash in Kitchen, needs attention' });
  const bounds = await pin.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 18, bounds.y + bounds.height / 2);
  return pin;
}
async function hoverTray(page, name = 'Maya') {
  const tray = page.getByRole('group', { name: `${name}, Unknown`, exact: true });
  const bounds = await tray.locator('.tray-slot').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 12 });
  return tray;
}

test('invalid drops return the task, Escape cancels a drag, and tapping still works', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const pin = await pickup(page);
  await page.mouse.move(15, 510, { steps: 10 });
  await expect(page.locator('.task-drag-proxy')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.task-drag-proxy')).toHaveCount(0);
  await expect(pin).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await pickup(page);
  await hoverTray(page);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.task-drag-proxy')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/task-dragging/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await pin.click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Trash', exact: true })).toBeVisible();
});

test('dragging expands the roommate dock within the full-screen workspace', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 150));
  await pickup(page);
  await page.mouse.move(230, 18, { steps: 8 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(30);
  const tray = await hoverTray(page);
  await expect(tray).toHaveClass(/drop-ready/);
  await page.screenshot({ path: 'test-results/advanced-drag.png' });
  await page.mouse.up();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Suggest task' })).toBeVisible();
  await expect(page.locator('.task-drag-proxy')).toHaveCount(0);
});

test('a sent suggestion and a completed task can each be undone', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await pickup(page);
  await hoverTray(page);
  await page.mouse.up();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Send suggestion' }).click();
  await expect(page.getByRole('button', { name: 'Take out the trash, pending by Maya' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Trash in Kitchen, needs attention' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take out the trash, pending by Maya' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Trash in Kitchen, needs attention' }).click();
  await dialog.getByRole('button', { name: 'I’ll take this' }).click();
  await dialog.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByRole('button', { name: 'Trash in Kitchen, all good' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Trash in Kitchen, assigned' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Trash in Kitchen, assigned' })).toBeVisible();
});

test('Undo remains clickable while the task popup is open', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trash in Kitchen, needs attention' }).click();
  const dialog = page.getByRole('dialog');
  const bounds = await dialog.boundingBox();
  await dialog.getByRole('button', { name: 'I’ll take this' }).click();
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'I’ll take this' })).toBeVisible();
  expect((await dialog.boundingBox()).height).toBe(bounds.height);
});

test('Undo does not overwrite a newer task update from another tab', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trash in Kitchen, needs attention' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Suggest to a roommate' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Maya Unknown' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send suggestion' }).click();
  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('button', { name: 'Trash in Kitchen, pending' }).click();
  await other.getByRole('dialog').getByRole('button', { name: 'Withdraw suggestion' }).click();
  await other.getByRole('dialog').getByRole('button', { name: 'Suggest to a roommate' }).click();
  await other.getByRole('dialog').getByRole('button', { name: 'Alex Unknown' }).click();
  await other.getByRole('dialog').getByRole('button', { name: 'Send suggestion' }).click();
  await expect(page.getByRole('button', { name: 'Take out the trash, pending by Alex' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('This task has changed');
  await expect(page.getByRole('button', { name: 'Take out the trash, pending by Alex' })).toBeVisible();
});

test('reduced motion disables decorative animation while drag and drop still work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await pickup(page);
  await hoverTray(page);
  await page.mouse.up();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('animation-name', 'none');
  await dialog.getByRole('button', { name: 'Send suggestion' }).click();
  await expect(page.locator('.button-ink')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Take out the trash, pending by Maya' })).toBeVisible();
});

test('button feedback stays inside the control without changing modal size', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await enterEdit(page);
  const edit = page.getByRole('button', { name: 'Add task', exact: true });
  const bounds = await edit.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await expect(edit.locator('.button-ink')).toHaveCount(1);
  await page.mouse.up();
  const dialog = page.getByRole('dialog');
  await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))); });
  const initial = await dialog.boundingBox();
  await dialog.getByLabel('Task name').fill('New task');
  const after = await dialog.boundingBox();
  expect(after.height).toBe(initial.height);
  expect(after.width).toBe(initial.width);
});
