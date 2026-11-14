import { test, expect, openAvailabilityDetails } from './fixtures';
import { initialState } from '../src/model';

const monday = new Date('2026-11-02T18:00:00Z'); // 1 pm apartment time.
const nav = page => page.locator('.mobile-nav');
async function openSchedule(page, seed = initialState()) {
  await page.clock.install({ time: monday });
  await page.addInitScript(value => { if (!localStorage.getItem('roomie-v1')) localStorage.setItem('roomie-v1', JSON.stringify(value)); }, seed);
  await page.goto('/');
  await nav(page).getByRole('button', { name: 'Schedule', exact: true }).click();
}
async function saveWindow(page, status, start, end) {
  const form = page.locator('.availability-window-form');
  await form.getByRole('button', { name: status, exact: true }).click();
  await form.getByLabel('Start time').fill(start);
  await form.getByLabel('End time').fill(end);
  await form.getByRole('button', { name: 'Save availability' }).click();
}
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));

test('specific date/time windows save only my availability, validate overlaps, edit and persist', async ({ page }) => {
  const seed = initialState();
  seed.people[1].routine = [{ id: 'maya-busy', date: '2026-11-02', days: [1], start: '12:00', end: '15:00', status: 'Studying' }];
  await openSchedule(page, seed);
  await expect(page.getByLabel('Schedule date')).toHaveValue('2026-11-02');
  await expect(page.getByLabel('Share for')).toHaveCount(0);
  await saveWindow(page, 'Busy', '14:00', '16:00');
  let state = await stored(page);
  expect(state.people.slice(1)).toEqual(seed.people.slice(1));
  const saved = state.people[0].routine[0];
  expect(saved).toMatchObject({ date: '2026-11-02', start: '14:00', end: '16:00', status: 'Studying' });
  await page.getByRole('button', { name: 'Edit Busy availability' }).click();
  await page.getByLabel('End time').fill('16:30');
  await page.getByRole('button', { name: 'Save availability' }).click();
  expect((await stored(page)).people[0].routine).toHaveLength(1);
  await saveWindow(page, 'Free', '15:00', '17:00');
  await expect(page.getByRole('alert')).toContainText('overlap');
  expect((await stored(page)).people[0].routine).toHaveLength(1);
  await page.reload();
  await nav(page).getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(page.locator('.schedule-saved-windows')).toContainText('2:00 pm – 4:30 pm');
  await page.getByRole('button', { name: 'Remove Busy availability' }).click();
  expect((await stored(page)).people[0].routine).toEqual([]);
});

test('busy and free windows automatically change the dock at their exact minute boundaries', async ({ page }) => {
  await openSchedule(page);
  await saveWindow(page, 'Busy', '13:01', '13:03');
  await saveWindow(page, 'Free', '13:03', '15:03');
  await page.getByRole('link', { name: 'nest.', exact: true }).click();
  await page.getByRole('button', { name: 'Expand availability', exact: true }).click();
  const self = page.locator('.availability-dock [data-person="jess"]');
  await expect(self).toHaveAttribute('data-drop-disabled', 'false');
  await page.clock.fastForward(60000);
  await expect(self).toHaveAttribute('data-drop-disabled', 'true');
  await expect(self).toHaveClass(/is-unavailable/);
  await expect(self).toHaveAttribute('aria-label', 'Jessalyn, Busy');
  await page.clock.fastForward(120000);
  await expect(self).toHaveAttribute('data-drop-disabled', 'false');
  await expect(self).not.toHaveClass(/is-unavailable/);
  await expect(self).toHaveAttribute('aria-label', 'Jessalyn, Free');
  await expect(page.locator('.availability-dock [data-person="alex"]')).toHaveAttribute('data-drop-disabled', 'false');
});

for (const attention of [true, false]) test(`busy dock layers reject ${attention ? 'pink' : 'yellow'} task drops while unknown layers accept them`, async ({ page }) => {
  const seed = initialState();
  seed.tasks[0].attention = attention;
  seed.people[1].routine = [{ id: 'maya-busy', date: '2026-11-02', start: '12:00', end: '15:00', status: 'Studying' }];
  await openSchedule(page, seed);
  await page.getByRole('link', { name: 'nest.', exact: true }).click();
  await page.getByRole('button', { name: 'Expand availability', exact: true }).click();
  const busy = page.locator('.availability-dock [data-person="maya"]');
  await expect(busy).toHaveClass(/is-unavailable/);
  await expect(busy.locator('.task-hint-target')).toHaveCount(0);
  const pin = page.locator('.map-page [data-object="trash1"]');
  async function dropOn(person, rejected = false) {
    await page.locator('.availability-dock').evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
    const from = await pin.boundingBox(), to = await page.locator(`.availability-dock [data-person="${person}"] .tray-slot`).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 18, from.y + from.height / 2);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    if (rejected) await expect(busy).not.toHaveClass(/drop-ready/);
    await page.mouse.up();
    await expect(page.locator('.task-drag-proxy')).toHaveCount(0);
  }
  await dropOn('maya', true);
  await expect(page.locator('.toast')).toHaveText('Maya is busy right now. Try another roommate.');
  const notice = await page.locator('.toast').boundingBox();
  const dock = await page.locator('.availability-dock').boundingBox();
  expect(notice.y + notice.height).toBeLessThanOrEqual(dock.y - 8);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await stored(page)).tasks[0]).toMatchObject({ status: 'open', to: null });
  await dropOn('alex');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Suggest task' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Alex/ })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Send suggestion' }).click();
  expect((await stored(page)).tasks[0]).toMatchObject({ status: 'pending', to: 'alex' });
});

test('weekly repeat is optional and the dock editor uses the same exact-date form', async ({ page }) => {
  await openSchedule(page);
  await page.getByRole('button', { name: 'Repeat weekly' }).click();
  await expect(page.getByRole('button', { name: 'Monday', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await saveWindow(page, 'Free', '12:00', '15:00');
  expect((await stored(page)).people[0].routine[0]).toMatchObject({ days: [1], start: '12:00', end: '15:00', status: 'Home & free' });
  expect((await stored(page)).people[0].routine[0].date).toBeUndefined();
  await page.getByRole('link', { name: 'nest.', exact: true }).click();
  await openAvailabilityDetails(page, 'Availability: Jessalyn, Usually free');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Set availability' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Busy', exact: true }).click();
  await dialog.getByLabel('Start time').fill('13:00');
  await dialog.getByLabel('End time').fill('14:00');
  await dialog.getByRole('button', { name: 'Save availability' }).click();
  await expect(page.locator('.availability-dock [data-person="jess"]')).toHaveAttribute('data-drop-disabled', 'true');
  expect((await stored(page)).people[0].routine).toHaveLength(2);
});

for (const width of [320, 440, 1280]) test(`simple schedule fits at ${width}px with read-only roommate windows`, async ({ page }) => {
  const seed = initialState();
  seed.people[1].routine = [{ id: 'maya-busy', date: '2026-11-02', start: '12:00', end: '15:00', status: 'Studying' }];
  seed.people[2].routine = [{ id: 'alex-free', days: [1], start: '13:00', end: '16:00', status: 'Home & free' }];
  await page.setViewportSize({ width, height: 956 });
  await page.clock.install({ time: monday });
  await page.addInitScript(value => localStorage.setItem('roomie-v1', JSON.stringify(value)), seed);
  await page.goto('/');
  await page.locator(width > 640 ? '.desktop-nav' : '.mobile-nav').getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save availability' })).toHaveCount(1);
  const maya = page.getByRole('article', { name: 'Maya availability', exact: true });
  await expect(maya).toContainText('Task drops paused now');
  await expect(maya.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Alex availability', exact: true })).toContainText('Task drops open now');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished)); });
  await page.screenshot({ path: `test-results/schedule-simple-${width}.png`, fullPage: true });
});

for (const width of [390, 1280]) test(`notifications stay above the dock and dismiss when a panel opens at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Expand availability', exact: true }).click();
  await page.locator('.availability-dock').evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
  await page.getByRole('button', { name: 'Edit apartment', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const toast = page.locator('.toast');
  await expect(toast).toHaveText('Layout saved.');
  const notice = await toast.boundingBox(), dock = await page.locator('.availability-dock').boundingBox();
  expect(notice.y + notice.height).toBeLessThanOrEqual(dock.y - 8);
  expect(notice.x).toBeGreaterThanOrEqual(11);
  expect(notice.x + notice.width).toBeLessThanOrEqual(width - 11);
  await expect(toast).toHaveCSS('background-color', 'rgb(255, 240, 233)');
  await page.getByRole('button', { name: 'Trash in Kitchen, needs attention', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(toast).toHaveCount(0);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(toast).toHaveCount(0);
});
