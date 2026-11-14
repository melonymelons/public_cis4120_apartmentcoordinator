import { test, expect } from './fixtures';
import { addRoom, dragRoom, enterEdit } from './layout-helpers';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
for (const [type, name, w, h] of [['hallway', 'Hallway', 4, 8], ['laundry', 'Laundry room', 6, 4]]) {
test(`${name} has its own artwork and saves after resizing`, async ({ page }) => {
  await page.goto('/');
  await addRoom(page, name);
  await expect(page.locator(`.map-camera .furniture-${type}`)).toHaveCount(1);
  await page.getByRole('button', { name: `Resize ${name}`, exact: true }).press('ArrowRight');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const room = (await saved(page)).rooms.find(room => room.type === type);
  expect(room).toMatchObject({ name, w, h });
  await page.reload();
  await page.getByRole('button', { name: `Open ${name}`, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(dialog.locator(`.furniture-${type}`)).toHaveCount(1);
  await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
  await dialog.screenshot({ path: `test-results/${type}-room.png` });
});
}
test('Add room is a visual picker; placement, naming, and saving happen on the canvas', async ({ page }) => {
  await page.goto('/');
  await enterEdit(page);
  await page.getByRole('button', { name: 'Add room', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Add room', exact: true })).toBeVisible();
  await expect(dialog.locator('.add-room-choice')).toHaveCount(7);
  await expect(dialog.getByRole('button', { name: 'Save layout' })).toHaveCount(0);
  await expect(dialog.getByLabel('Width', { exact: true })).toHaveCount(0);
  await dialog.screenshot({ path: 'test-results/add-room-picker.png', animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Add Custom room', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.map-room')).toHaveCount(6);
  expect((await saved(page)).rooms.length).toBe(5);
  await page.getByRole('textbox', { name: 'Room name', exact: true }).fill('Study');
  await page.screenshot({ path: 'test-results/rearrange-canvas.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  expect((await saved(page)).rooms.find(room => room.name === 'Study')).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Open Study', exact: true })).toBeVisible();
});

for (const touch of [false, true]) {
  test.describe(touch ? 'touch arrangement' : 'mouse arrangement', () => {
    test.use({ hasTouch: touch });
    test('move a room directly, retain objects/tasks, and restore normal canvas behavior after Done', async ({ page }) => {
      await page.goto('/');
      const before = await saved(page);
      await page.getByRole('button', { name: 'Edit apartment', exact: true }).click();
      await dragRoom(page, 'kitchen', 12, 0, touch);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      const after = await saved(page);
      expect(after.rooms.find(room => room.id === 'kitchen').x).toBe(12);
      expect(after.objects).toEqual(before.objects);
      expect(after.tasks).toEqual(before.tasks);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.reload();
      expect((await saved(page)).rooms.find(room => room.id === 'kitchen').x).toBe(12);
      await page.getByRole('button', { name: 'Open Kitchen', exact: true }).click({ position: { x: 15, y: 90 } });
      await expect(page.getByRole('dialog').getByRole('heading', { name: 'Kitchen', exact: true })).toBeVisible();
    });
    test('a slight overlap settles into the obvious nearby space', async ({ page }) => {
      await page.goto('/');
      const before = await saved(page);
      await enterEdit(page);
      await dragRoom(page, 'kitchen', 11, 0, touch);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      const after = await saved(page);
      expect(after.rooms.find(room => room.id === 'kitchen')).toMatchObject({ x: 12, y: 0, w: 6, h: 6 });
      expect(after.rooms.filter(room => room.id !== 'kitchen')).toEqual(before.rooms.filter(room => room.id !== 'kitchen'));
      expect(after.objects).toEqual(before.objects);
      expect(after.tasks).toEqual(before.tasks);
    });
  });
}

test('invalid drops return a room, Cancel discards edits, and room corners resize with keyboard support', async ({ page }) => {
  await page.goto('/');
  const before = await saved(page);
  await page.getByRole('button', { name: 'Edit apartment', exact: true }).click();
  const kitchen = page.locator('[data-room="kitchen"]');
  const originalLeft = await kitchen.evaluate(el => el.style.left);
  await dragRoom(page, 'kitchen', 6, 0);
  await expect(page.getByRole('alert')).toContainText('Rooms need their own space');
  expect(await kitchen.evaluate(el => el.style.left)).toBe(originalLeft);
  await page.getByRole('button', { name: 'Resize Jessalyn’s room', exact: true }).press('ArrowDown');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await saved(page)).rooms).toEqual(before.rooms);
  await page.getByRole('button', { name: 'Edit apartment', exact: true }).click();
  await page.getByRole('button', { name: 'Resize Jessalyn’s room', exact: true }).press('ArrowDown');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect((await saved(page)).rooms.find(room => room.id === 'bedroom1').h).toBe(6);
});

test.describe('pinching while rearranging', () => {
  test.use({ hasTouch: true });
  test('two fingers zoom instead of moving a room', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Edit apartment' }).tap();
    const room = page.locator('[data-room="kitchen"]');
    const before = await room.evaluate(el => ({ left: el.style.left, top: el.style.top }));
    const box = await room.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 20, y, id: 1 }, { x: x + 20, y, id: 2 }] });
    for (let i = 1; i <= 6; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 20 - i * 5, y, id: 1 }, { x: x + 20 + i * 5, y, id: 2 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await page.locator('.map-camera').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)).toBeGreaterThan(1.5);
    expect(await room.evaluate(el => ({ left: el.style.left, top: el.style.top }))).toEqual(before);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).tap();
  });
});

test('Edit reveals add controls, stages objects in new rooms, and Done or Cancel handles additions together', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add task', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add room', exact: true })).toHaveCount(0);
  await enterEdit(page);
  await page.getByRole('button', { name: 'Add room', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add Custom room', exact: true }).click();
  await page.getByRole('textbox', { name: 'Room name', exact: true }).fill('Pantry');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task name').fill('Basket');
  await dialog.getByRole('combobox', { name: 'Room', exact: true }).click();
  await dialog.getByRole('option', { name: 'Pantry', exact: true }).click();
  await expect(dialog.getByLabel('First task (optional)')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Add to apartment' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  expect((await saved(page)).objects.some(object => object.name === 'Basket')).toBe(false);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const after = await saved(page);
  const basket = after.objects.find(object => object.name === 'Basket');
  expect(after.rooms.find(room => room.id === basket.roomId).name).toBe('Pantry');
  expect(after.tasks.some(task => task.objectId === basket.id && task.title === 'Basket' && task.status === 'open')).toBe(true);
  await expect(page.getByRole('button', { name: 'Add room', exact: true })).toHaveCount(0);
  await enterEdit(page);
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await dialog.getByLabel('Task name').fill('Discarded object');
  await dialog.getByRole('button', { name: 'Add to apartment' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await saved(page)).objects).toEqual(after.objects);
});
