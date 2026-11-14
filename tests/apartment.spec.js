import { addRoom, dragRoom, seedEmptyApartment, enterEdit } from './layout-helpers';
import { test, expect, setFixtureUser, openAvailabilityDetails } from './fixtures';

// Existing multi-task objects are a legacy fixture; new work is created from
// the apartment/room add controls rather than the flagged-task popup.
async function addFixtureTask(page, objectKey, title, notes = '', attention = true) {
  await page.evaluate(({ objectKey, title, notes, attention }) => {
    const state = JSON.parse(localStorage.getItem('roomie-v1'));
    const object = state.objects.find(o => o.id === objectKey || o.name === objectKey);
    state.tasks.push({ id: 'fixture-extra-task', objectId: object.id, title, notes, attention, status: 'open', from: state.currentUser, to: null });
    localStorage.setItem('roomie-v1', JSON.stringify(state));
  }, { objectKey, title, notes, attention });
  await page.reload();
}

test('custom objects support multiple tasks and task-specific tray requests', async ({ page }) => {
  await page.goto('/');
  await enterEdit(page);
  await page.getByRole('button', { name: 'Add task' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Other', exact: true }).click();
  await dialog.getByLabel('Task name').fill('Coffee station');
  await dialog.getByRole('button', { name: 'Add to apartment' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Coffee station in Kitchen, open' }).click();
  await dialog.getByLabel('What needs doing?').fill('Wipe counter');
  await dialog.getByRole('button', { name: 'Flag for attention', exact: true }).click();
  await addFixtureTask(page, 'Coffee station', 'Refill beans', 'Use the shared jar.', false);
  await page.getByRole('button', { name: 'Coffee station in Kitchen, needs attention' }).click();
  await dialog.getByRole('group', { name: 'Tasks for this object' }).getByRole('button', { name: 'Refill beans' }).click();
  await expect(dialog.getByRole('group', { name: 'Tasks for this object' }).getByRole('button')).toHaveCount(2);
  await dialog.getByLabel('What needs doing?').fill('Refill coffee beans');
  await dialog.getByRole('button', { name: 'Flag for attention', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  const pin = page.getByRole('button', { name: 'Coffee station in Kitchen, needs attention' });
  const start = await pin.boundingBox();
  const tray = page.getByRole('group', { name: 'Maya, Unknown', exact: true });
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 18, start.y + start.height / 2);
  const target = await tray.locator('.tray-slot').boundingBox();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await expect(pin).toHaveClass(/dragging/);
  await expect(tray).toHaveClass(/drop-ready/);
  await page.mouse.up();
  await expect(dialog.getByRole('heading', { name: 'Which task?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Refill coffee beans' }).click();
  await dialog.getByRole('button', { name: 'Send suggestion' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'Roommate availability dock' })).toHaveClass(/collapsed/);
  await tray.getByRole('button', { name: 'Refill coffee beans, pending by Maya' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Roommate availability dock' })).toHaveClass(/expanded/);
  await tray.getByRole('button', { name: 'Refill coffee beans, pending by Maya' }).click();
  await expect(dialog.getByRole('heading', { name: 'Refill coffee beans' })).toBeVisible();
  await expect(dialog.getByText('Use the shared jar.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Edit object' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Delete task', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Coffee station in Kitchen, needs attention' }).click();
  await dialog.getByRole('group', { name: 'Tasks for this object' }).getByRole('button', { name: 'Refill coffee beans' }).click();
  await expect(dialog.getByRole('heading', { name: 'Refill coffee beans' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Tasks for this object' }).getByRole('button', { name: 'Wipe counter' })).toBeVisible();
  await dialog.screenshot({ path: 'test-results/custom-object.png' });
});

test('completing one task keeps other tasks on the same object open', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trash in Kitchen, needs attention' }).click();
  const dialog = page.getByRole('dialog');
  await addFixtureTask(page, 'trash1', 'Replace liner');
  await page.getByRole('button', { name: 'Trash in Kitchen, needs attention' }).click();
  await dialog.getByRole('group', { name: 'Tasks for this object' }).getByRole('button', { name: 'Replace liner' }).click();
  await dialog.getByRole('button', { name: 'I’ll take this' }).click();
  await dialog.getByRole('button', { name: 'Mark complete' }).click();
  await expect(dialog.getByRole('heading', { name: 'Take out the trash' })).toBeVisible();
  await dialog.getByText('Completed (1)', { exact: true }).click();
  await expect(dialog.getByText('Replace liner', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('button', { name: 'Trash in Kitchen, needs attention' })).toBeVisible();
});

test('add rooms to the existing apartment, including on HTTP previews', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }));
  await page.goto('/');
  for (let i = 0; i < 10; i++) await addRoom(page, 'Bedroom');
  await expect(page.locator('.map-room')).toHaveCount(15);
  await page.getByRole('textbox', { name: 'Room name', exact: true }).fill('New bedroom');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  await expect(page.getByText('New bedroom', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trash in Kitchen, needs attention' })).toBeVisible();
  await enterEdit(page);
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Laundry', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add to apartment' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Run a load of laundry in Kitchen, open' }).click();
  await dialog.getByRole('button', { name: 'Flag for attention', exact: true }).click();
  await expect(dialog.getByText('Needs a hand', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a room can be resized to a larger size directly with the keyboard', async ({ page }) => {
  await seedEmptyApartment(page);
  await page.goto('/');
  await addRoom(page, 'Custom room');
  const handle = page.getByRole('button', { name: 'Resize Custom room', exact: true });
  for (let i = 0; i < 8; i++) await handle.press('ArrowRight');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).rooms[0].w)).toBe(12);
});

test('repeated object additions get separate positions', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 2; i++) {
    await enterEdit(page);
    await page.getByRole('button', { name: 'Add task' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Add to apartment' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  }
  const pins = page.getByRole('button', { name: 'Take out the trash in Kitchen, open' });
  await expect(pins).toHaveCount(2);
  const positions = await pins.evaluateAll(elements => elements.map(el => `${el.style.left},${el.style.top}`));
  expect(new Set(positions).size).toBe(2);
});

test.describe('touch editing', () => {
  test.use({ hasTouch: true });
  test('touch-drag a task into an availability tray', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const pin = page.getByRole('button', { name: 'Trash in Kitchen, needs attention' });
    const tray = page.getByRole('group', { name: 'Maya, Unknown', exact: true });
    const source = await pin.boundingBox();
    const start = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 18, y: start.y }] });
    const target = await tray.locator('.tray-slot').boundingBox();
    const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    for (let i = 1; i <= 12; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * i / 12, y: start.y + (end.y - start.y) * i / 12 }] });
    await expect(tray).toHaveClass(/drop-ready/);
    await expect(tray.locator('.tray-ghost')).toHaveCSS('opacity', '0.65');
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Maya Unknown' })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: 'Send suggestion' }).tap();
    await expect(tray.getByRole('button', { name: 'Take out the trash, pending by Maya' })).toBeVisible();
    await expect(page.locator('body')).not.toHaveClass(/task-dragging/);
  });
  test('corner X removes a room in the draft; Cancel restores it and Done removes its objects', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Edit apartment' }).tap();
    await page.getByRole('button', { name: 'Delete Bathroom', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Move Bathroom', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Supplies in Bathroom, needs attention' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit apartment' }).tap();
    await page.getByRole('button', { name: 'Delete Bathroom', exact: true }).tap();
    await page.getByRole('button', { name: 'Done', exact: true }).tap();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Supplies in Bathroom, needs attention' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open Bathroom', exact: true })).toHaveCount(0);
  });

  test('move a room on the apartment canvas with a finger gesture', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Edit apartment' }).tap();
    await dragRoom(page, 'kitchen', 12, 0, true);
    await page.getByRole('button', { name: 'Done', exact: true }).tap();
    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).rooms.find(room => room.id === 'kitchen').x)).toBe(12);
  });


});

test('mobile map renders without overflow or runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Apartment', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trash in Kitchen, needs attention' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const mobileMap = await page.locator('.map-wrap').boundingBox();
  const mobileDock = await page.locator('.availability-dock').boundingBox();
  expect(mobileMap.width).toBeGreaterThan(370);
  expect(mobileMap.height).toBeGreaterThan(400);
  expect(mobileMap.height).toBeGreaterThan(700);
  expect(mobileDock.y + mobileDock.height).toBeLessThan(mobileMap.y + mobileMap.height);
  await expect(page.locator('.availability-dock')).toHaveClass(/collapsed/);
  await expect(page.locator('.attention-section')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const desktopMap = await page.locator('.map-wrap').boundingBox();
  const dock = await page.locator('.availability-dock').boundingBox();
  const canvas = await page.locator('.map-camera > .map-canvas').boundingBox();
  expect(desktopMap.width).toBe(1280);
  expect(desktopMap.width).toBeGreaterThan(dock.width * 10);
  expect(canvas.height).toBeGreaterThan(600);
  expect(dock.x + dock.width).toBeLessThan(desktopMap.x + desktopMap.width);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('build a custom layout, save it, reload it, and discard an edit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit apartment' }).click();
  for (const room of ['Kitchen', 'Living room', 'Bathroom', 'Jessalyn’s room', 'Maya & Alex’s room']) await page.getByRole('button', { name: `Delete ${room}`, exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await addRoom(page, 'Kitchen');
  await page.getByRole('textbox', { name: 'Room name', exact: true }).fill('Our kitchen');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  await expect(page.getByText('Our kitchen', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit apartment' }).click();
  await page.getByRole('button', { name: 'Move Our kitchen', exact: true }).click();
  await page.getByRole('textbox', { name: 'Room name', exact: true }).fill('Discard this name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).rooms[0].name)).toBe('Our kitchen');
  await enterEdit(page);
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to apartment' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Take out the trash in Our kitchen, open' })).toBeVisible();
});

test('suggest a task, switch roommates, accept, and complete', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trash in Kitchen, needs attention' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Suggest to a roommate' }).click();
  await dialog.getByRole('button', { name: 'Maya Unknown' }).click();
  await dialog.getByRole('button', { name: 'Send suggestion' }).click();
  await expect(page.getByRole('button', { name: 'Trash in Kitchen, pending' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take out the trash, pending by Maya' })).toBeVisible();
  await setFixtureUser(page, 'maya');
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Apartment', exact: true }).click();
  await page.getByRole('button', { name: 'Trash in Kitchen, pending' }).click();
  await dialog.getByRole('button', { name: 'Accept suggestion' }).click();
  await expect(dialog.getByText('Someone’s on it')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('button', { name: 'Trash in Kitchen, assigned' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take out the trash, accepted by Maya' })).toBeVisible();
  await page.getByRole('button', { name: 'Trash in Kitchen, assigned' }).click();
  await dialog.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByRole('button', { name: 'Trash in Kitchen, all good' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take out the trash, accepted by Maya' })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'To-dos' }).click();
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.getByRole('button', { name: /Take out the trash.*Completed by Maya/ })).toBeVisible();
});

test('availability changes persist', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T18:00:00Z') });
  await page.goto('/');
  await openAvailabilityDetails(page, 'Availability: Jessalyn, Unknown');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Busy', exact: true }).click();
  await dialog.getByLabel('Start time').fill('12:00');
  await dialog.getByLabel('End time').fill('15:00');
  await dialog.getByRole('button', { name: 'Save availability' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Availability: Jessalyn, Busy' })).toBeVisible();
});

test('dragging a task onto a mobile availability card opens a suggestion', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const pin = page.getByRole('button', { name: 'Trash in Kitchen, needs attention' });
  const target = page.getByRole('group', { name: 'Maya, Unknown', exact: true });
  const source = await pin.boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 18, source.y + source.height / 2);
  const dest = await target.boundingBox();
  await page.mouse.move(dest.x + dest.width / 2, dest.y + dest.height / 2, { steps: 12 });
  await expect(pin).toHaveClass(/dragging/);
  await expect(target).toHaveClass(/drop-ready/);
  await expect(target.locator('.tray-ghost')).toHaveCSS('opacity', '0.65');
  await page.screenshot({ path: 'test-results/tray-drag.png' });
  await page.mouse.up();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Suggest task' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Maya Unknown' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Send suggestion' }).click();
  await expect(pin).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Trash in Kitchen, pending' })).toBeVisible();
});

test('dragging and resizing rooms save valid grid positions directly on the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seedEmptyApartment(page);
  await page.goto('/');
  await addRoom(page, 'Custom room');
  const id = await page.locator('.map-room').getAttribute('data-room');
  await dragRoom(page, id, 3, 2);
  const map = page.locator('.map-camera > .map-canvas');
  const bounds = await map.boundingBox();
  const cols = Number(await map.getAttribute('data-cols')), rows = Number(await map.getAttribute('data-rows'));
  const handle = await page.getByRole('button', { name: 'Resize Custom room', exact: true }).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + bounds.width / cols, handle.y + handle.height / 2 + bounds.height / rows, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const room = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).rooms[0]);
  expect(room).toMatchObject({ x: 3, y: 2, w: 5, h: 5 });
});
