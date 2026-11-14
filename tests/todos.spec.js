import { test, expect } from './fixtures';
import { initialState } from '../src/model';

async function openTasks(page, extra = {}) {
  const state = initialState();
  state.tasks.push(
    { id: 'reply', objectId: 'dishes1', title: 'Wash the dishes', status: 'pending', from: 'maya', to: 'jess' },
    { id: 'mine', objectId: 'cleaning1', title: 'Vacuum the rug', status: 'assigned', from: 'jess', to: 'jess' },
    { id: 'other', objectId: 'dishes1', title: 'Clean the counter', status: 'assigned', from: 'maya', to: 'maya' },
    { id: 'waiting', objectId: 'trash1', title: 'Sort recycling', status: 'pending', from: 'jess', to: 'alex' },
  );
  Object.assign(state, extra);
  await page.addInitScript(state => { if (!localStorage.getItem('roomie-v1')) localStorage.setItem('roomie-v1', JSON.stringify(state)); }, state);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'To-dos' }).click();
}

test('groups tasks by responsibility and supports accept, complete, undo, claim and withdraw', async ({ page }) => {
  await openTasks(page);
  await expect(page.getByRole('region', { name: 'Needs your reply' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Clean the counter' }).getByRole('button', { name: /Complete task/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Accept task: Wash the dishes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your tasks' }).getByRole('article', { name: 'Wash the dishes' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete task: Wash the dishes', exact: true }).click();
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.getByRole('button', { name: /Wash the dishes.*Completed by Jessalyn/ })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'For me', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Wash the dishes' })).toBeVisible();
  await page.getByRole('button', { name: 'Active', exact: true }).click();
  await page.getByRole('button', { name: 'Take task: Take out the trash', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your tasks' }).getByRole('article', { name: 'Take out the trash' })).toBeVisible();
  await page.getByRole('button', { name: 'Withdraw task: Sort recycling', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Up for grabs' }).getByRole('article', { name: 'Sort recycling' })).toBeVisible();
});

test('search and room filters intersect, and a new task persists on the selected object', async ({ page }) => {
  await openTasks(page);
  await page.getByRole('searchbox', { name: 'Search tasks' }).fill('trash');
  await page.getByRole('combobox', { name: 'Filter tasks by room' }).click();
  await page.getByRole('option', { name: 'Bathroom', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No matching tasks' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('article', { name: 'Take out the trash' })).toBeVisible();
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Room', exact: true }).click();
  await dialog.getByRole('option', { name: 'Bathroom', exact: true }).click();
  await dialog.getByLabel('Task name').fill('Refill hand soap');
  await dialog.getByRole('button', { name: 'Add to apartment' }).click();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Refill hand soap' })).toContainText('Bathroom');
  await page.reload();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'To-dos' }).click();
  await expect(page.getByRole('article', { name: 'Refill hand soap' })).toBeVisible();
  const task = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).tasks.find(t => t.title === 'Refill hand soap'));
  expect(task).toMatchObject({ title: 'Refill hand soap', status: 'open', from: 'jess', to: null });
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('roomie-v1')).objects.find(o => o.id === id).roomId, task.objectId)).toBe('bathroom');
});

test('declining reopens a task and suggesting requires choosing a roommate', async ({ page }) => {
  await openTasks(page);
  await page.getByRole('button', { name: 'Decline task: Wash the dishes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Up for grabs' }).getByRole('article', { name: 'Wash the dishes' })).toBeVisible();
  await page.getByRole('button', { name: 'Suggest task: Wash the dishes', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Send suggestion' })).toBeDisabled();
  await dialog.getByRole('button', { name: /Maya/ }).click();
  await dialog.getByRole('button', { name: 'Send suggestion' }).click();
  await expect(page.getByRole('region', { name: 'Waiting on a roommate' }).getByRole('article', { name: 'Wash the dishes' })).toContainText('Suggested to Maya');
});

test('an apartment without rooms directs task creation to the apartment editor', async ({ page }) => {
  await openTasks(page, { rooms: [], objects: [], tasks: [] });
  await page.getByRole('button', { name: 'Add task', exact: true }).first().click();
  await expect(page.getByText('Add a room before placing tasks.')).toBeVisible();
  await page.getByRole('button', { name: 'Add a room', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Add room' })).toBeVisible();
});

for (const width of [320, 390, 1280]) test(`task layout fits at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  if (width >= 768) {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTasks(page);
    await page.setViewportSize({ width, height: 844 });
  } else await openTasks(page);
  await expect(page.getByRole('heading', { name: 'To-dos', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); await Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished)); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.screenshot({ path: `test-results/todos-${width}.png` });
});


test('task groups collapse like Profile, and secondary actions are proper buttons', async ({ page }) => {
  await openTasks(page);
  await expect(page.getByRole('button', { name: 'Add item', exact: true })).toHaveCount(0);
  const group = page.locator('.todo-group-reply');
  const toggle = group.locator('.profile-section-toggle');
  const bounds = await toggle.boundingBox();
  await toggle.click();
  await expect(group.locator('.profile-section-panel')).toBeHidden();
  expect((await toggle.boundingBox()).height).toBeCloseTo(bounds.height, 1);
  await toggle.click();
  await expect(group.getByRole('article', { name: 'Wash the dishes', exact: true })).toBeVisible();
  const decline = group.getByRole('button', { name: 'Decline task: Wash the dishes' });
  expect(await decline.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('solid');
  await group.locator('.profile-section-panel').evaluate(async el => { await Promise.allSettled(el.getAnimations().map(a => a.finished)); });
  const rows = await group.locator('.todo-actions').evaluate(el => [...el.children].map(button => button.getBoundingClientRect().y));
  expect(Math.abs(rows[0] - rows[1])).toBeLessThan(1);
  await page.getByRole('searchbox', { name: 'Search tasks' }).fill('rug');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear task search' }).click();
  await expect(page.getByRole('article', { name: 'Wash the dishes', exact: true })).toBeVisible();
});


test('adding a task reopens its section when Up for grabs was collapsed', async ({ page }) => {
  await openTasks(page);
  await page.locator('.todo-group-open .profile-section-toggle').click();
  await expect(page.locator('.todo-group-open .profile-section-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task name').fill('Wipe the table');
  await dialog.getByRole('button', { name: 'Add to apartment' }).click();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.locator('.todo-group-open .profile-section-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('article', { name: 'Wipe the table', exact: true })).toBeVisible();
});
