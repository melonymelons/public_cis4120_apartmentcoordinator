import { test, expect } from './fixtures';
import { initialState } from '../src/model';

async function openFromProfile(page, width) {
  await page.goto('/');
  await page.getByRole('navigation', { name: width > 640 ? 'Main navigation' : 'Mobile navigation', exact: true }).getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('article', { name: 'Maya household profile' }).locator('.household-member-detail').click();
  const dialog = page.getByRole('dialog');
  await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); });
  return dialog;
}

for (const width of [320, 390, 1280]) test(`roommate popup from Profile fits its content at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const dialog = await openFromProfile(page, width);
  await expect(dialog.getByRole('heading', { name: 'Maya’s availability', exact: true })).toBeVisible();
  await expect(dialog.getByText('No current availability shared')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Edit|Remove|Save/ })).toHaveCount(0);
  expect((await dialog.boundingBox()).height).toBeLessThan(450);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.screenshot({ path: `test-results/person-panel-${width}.png` });
  await dialog.getByRole('button', { name: /Take out the trash/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Suggest task', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Maya/ })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Send suggestion' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).tasks.find(t => t.id === 'task-trash'))).toMatchObject({ status: 'pending', to: 'maya' });
});

test('shared routines are shown read-only without availability editing controls', async ({ page }) => {
  const state = initialState();
  state.people[1] = { ...state.people[1], status: 'Studying', expires: Date.now() + 3600000, routine: [{ id: 'usual', days: [1, 2, 3, 4, 5], start: '18:00', end: '20:00', status: 'Home & free' }] };
  await page.addInitScript(value => localStorage.setItem('roomie-v1', JSON.stringify(value)), state);
  const dialog = await openFromProfile(page, 390);
  await expect(dialog.getByText('Studying', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Shared availability', exact: true })).toBeVisible();
  await expect(dialog.getByText('Free', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Edit|Delete|Update availability/ })).toHaveCount(0);
  await dialog.screenshot({ path: 'test-results/person-panel-routine.png' });
});

for (const width of [320, 390, 1280]) test(`many tasks have a three-task preview and a searchable room-filtered picker at ${width}px`, async ({ page }) => {
  const state = initialState();
  state.tasks = Array.from({ length: 12 }, (_, index) => ({ id: `task-${index}`, objectId: ['trash1', 'supplies1', 'cleaning1'][index % 3], title: `Chore ${index + 1}`, status: 'open', from: 'jess', to: null }));
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(value => { if (!localStorage.getItem('roomie-v1')) localStorage.setItem('roomie-v1', JSON.stringify(value)); }, state);
  const dialog = await openFromProfile(page, width);
  await expect(dialog.locator('.person-task-choice')).toHaveCount(3);
  await expect(dialog.getByRole('button', { name: 'View all tasks', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'View all tasks', exact: true }).click();
  await expect(dialog.getByRole('searchbox', { name: 'Search tasks' })).toBeFocused();
  await expect(dialog.locator('.person-task-choice')).toHaveCount(12);
  const initialHeight = (await dialog.boundingBox()).height;
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.screenshot({ path: `test-results/person-all-tasks-${width}.png` });
  await dialog.getByRole('searchbox', { name: 'Search tasks' }).fill('Chore 5');
  await expect(dialog.locator('.person-task-choice')).toHaveCount(1);
  const result = await dialog.locator('.person-task-choice').boundingBox();
  const panel = await dialog.boundingBox();
  expect(panel.y + panel.height - result.y - result.height).toBeLessThan(30);
  const back = await dialog.getByRole('button', { name: 'Back', exact: true }).boundingBox();
  const tools = await dialog.locator('.person-task-tools').boundingBox();
  expect(tools.y - back.y - back.height).toBeGreaterThanOrEqual(20);
  await dialog.getByRole('combobox', { name: 'Filter tasks by room' }).click();
  await dialog.getByRole('option', { name: 'Kitchen', exact: true }).click();
  await expect(dialog.getByText('No matching tasks', { exact: true })).toBeVisible();
  expect((await dialog.boundingBox()).height).toBeLessThan(initialHeight);
  await dialog.getByRole('button', { name: 'Clear filters' }).click();
  await expect(dialog.locator('.person-task-choice')).toHaveCount(12);
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.locator('.person-task-choice')).toHaveCount(3);
  await expect(dialog.getByRole('button', { name: 'View all tasks', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: 'View all tasks', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Filter tasks by room' }).click();
  await dialog.getByRole('option', { name: 'Kitchen', exact: true }).click();
  await expect(dialog.locator('.person-task-choice')).toHaveCount(4);
  await dialog.getByRole('searchbox', { name: 'Search tasks' }).fill('Chore 10');
  await dialog.getByRole('button', { name: /Chore 10/ }).click();
  await expect(dialog.getByRole('button', { name: /Maya/ })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Send suggestion' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).tasks.find(task => task.id === 'task-9'))).toMatchObject({ status: 'pending', to: 'maya' });
});
