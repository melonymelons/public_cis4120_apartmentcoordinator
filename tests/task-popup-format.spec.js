import { test, expect } from './fixtures';
import { initialState } from '../src/model';

for (const width of [320, 390, 1280]) for (const status of ['open', 'assigned']) test(`${status} task popup has one title and consistent spacing at ${width}px`, async ({ page }) => {
  const state = initialState();
  state.objects[0].name = 'Water plants';
  state.tasks[0] = { ...state.tasks[0], title: 'Water plants', attention: true, status, to: status === 'assigned' ? 'jess' : null };
  state.inventory = [];
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(value => { if (!localStorage.getItem('roomie-v1')) localStorage.setItem('roomie-v1', JSON.stringify(value)); }, state);
  await page.goto('/');
  await page.locator('[data-object="trash1"]').click();
  const dialog = page.getByRole('dialog');
  await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); });
  await dialog.screenshot({ path: `test-results/task-popup-${status}-${width}.png` });
  await expect(dialog.getByText('Water plants', { exact: true })).toHaveCount(1);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await dialog.locator('.modal-body').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: /Edit|Delete|Add task|Add item/ })).toHaveCount(0);
  if (status === 'assigned') await expect(dialog.getByRole('button', { name: 'Mark complete', exact: true })).toBeVisible();
  else await expect(dialog.getByRole('button', { name: 'I’ll take this', exact: true })).toBeVisible();
});
