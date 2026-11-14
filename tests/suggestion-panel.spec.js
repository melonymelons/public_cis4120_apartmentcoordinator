import { test, expect } from './fixtures';
import { initialState } from '../src/model';

async function openSuggestion(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trash in Kitchen, needs attention', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Suggest to a roommate' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); });
  return dialog;
}

for (const width of [320, 390, 1280]) test(`suggestion panel is compact, stable and sends to the selected roommate at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const dialog = await openSuggestion(page);
  const before = await dialog.boundingBox();
  expect(before.height).toBeLessThan(450);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(dialog.getByText('Take out the trash', { exact: true })).toHaveCount(1);
  const send = dialog.getByRole('button', { name: 'Send suggestion' });
  await expect(send).toBeDisabled();
  const maya = dialog.getByRole('button', { name: /Maya/ });
  await maya.focus(); await maya.press('Enter');
  await expect(maya).toHaveAttribute('aria-pressed', 'true');
  await expect(send).toBeEnabled();
  const after = await dialog.boundingBox();
  expect(after.height).toBeCloseTo(before.height, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  await dialog.screenshot({ path: `test-results/suggestion-panel-${width}.png` });
  await send.click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).tasks.find(t => t.id === 'task-trash'))).toMatchObject({ status: 'pending', to: 'maya' });
});

test('Cancel keeps the task open', async ({ page }) => {
  const dialog = await openSuggestion(page);
  await dialog.getByRole('button', { name: /Alex/ }).click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).tasks.find(t => t.id === 'task-trash'))).toMatchObject({ status: 'open', to: null });
});

test('an apartment without roommates provides a Profile route and prevents sending', async ({ page }) => {
  const state = initialState();
  state.people = state.people.filter(p => p.id === state.currentUser);
  await page.addInitScript(value => localStorage.setItem('roomie-v1', JSON.stringify(value)), state);
  const dialog = await openSuggestion(page);
  await expect(dialog.getByText('Add a roommate to your apartment to send suggestions.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Send suggestion' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Go to Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
});
