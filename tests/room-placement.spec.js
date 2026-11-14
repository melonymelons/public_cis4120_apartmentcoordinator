import { test, expect } from './fixtures';

test.use({ hasTouch: true });
const positions = page => page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('roomie-v1'));
  return { objects: state.objects, inventory: state.inventory, tasks: state.tasks };
});
const point = marker => marker.evaluate(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }));
async function drag(page, marker, dx, dy) {
  const box = await marker.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 5 });
  await page.mouse.up();
}

for (const width of [390, 1280]) test(`room placement drafts task and item moves until Confirm at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 956 });
  await page.goto('/');
  const before = await positions(page);
  await page.getByRole('button', { name: 'Open Bathroom', exact: true }).click({ position: { x: 8, y: 8 } });
  const dialog = page.getByRole('dialog');
  await dialog.evaluate(async el => { await Promise.allSettled(el.getAnimations().map(a => a.finished)); });
  const task = dialog.locator('[data-object="supplies1"]'), item = dialog.locator('[data-item="stock-paper"]');
  const originalTask = await point(task), originalItem = await point(item);
  const size = await dialog.locator('.map-canvas').boundingBox();
  const add = await dialog.getByRole('button', { name: 'Add item', exact: true }).boundingBox();
  const edit = await dialog.getByRole('button', { name: 'Edit placement', exact: true }).boundingBox();
  expect(edit.y).toBeGreaterThanOrEqual(add.y + add.height);
  await dialog.getByRole('button', { name: 'Edit placement' }).click();
  await expect(dialog.locator('.is-editing-markers')).toHaveCount(1);
  expect((await dialog.locator('.map-canvas').boundingBox()).height).toBeCloseTo(size.height, 1);
  await expect(dialog.getByRole('button', { name: 'Add item', exact: true })).toHaveCount(0);
  await drag(page, task, 25, 0); await drag(page, item, -20, 14);
  expect(await positions(page)).toEqual(before);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await point(task)).toEqual(originalTask); expect(await point(item)).toEqual(originalItem);
  await dialog.getByRole('button', { name: 'Edit placement' }).click();
  await drag(page, task, 25, 0); await drag(page, item, -20, 14);
  await item.focus(); await page.keyboard.press('ArrowDown');
  const movedTask = await point(task), movedItem = await point(item);
  await dialog.evaluate(async el => { await Promise.allSettled(el.getAnimations().map(a => a.finished)); });
  await page.screenshot({ path: `test-results/room-placement-${width}.png` });
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  const saved = await positions(page);
  expect(saved.tasks).toEqual(before.tasks);
  const storedTask = saved.objects.find(object => object.id === 'supplies1');
  const storedItem = saved.inventory.find(item => item.id === 'stock-paper');
  expect(storedTask.x).toBeCloseTo(movedTask.x, 3); expect(storedTask.y).toBeCloseTo(movedTask.y, 3);
  expect(storedItem.x).toBeCloseTo(movedItem.x, 3); expect(storedItem.y).toBeCloseTo(movedItem.y, 3);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  expect(await point(page.locator('.map-page [data-object="supplies1"]'))).toEqual(movedTask);
  expect(await point(page.locator('.map-page [data-item="stock-paper"]'))).toEqual(movedItem);
});

test('touch dragging an item stays in the room and pointer cancellation restores its draft position', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Bathroom', exact: true }).click({ position: { x: 8, y: 8 } });
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Edit placement' }).click();
  const item = dialog.locator('[data-item="stock-paper"]');
  const initial = await point(item), box = await item.boundingBox();
  const client = await context.newCDPSession(page);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await expect(dialog.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled();
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - 25, y: start.y + 10 }] });
  expect(await point(item)).not.toEqual(initial);
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(await point(item)).toEqual(initial);
  await expect(dialog.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Bathroom', exact: true })).toBeVisible();
});
