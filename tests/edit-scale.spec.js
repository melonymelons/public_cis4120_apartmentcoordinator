import { test, expect } from './fixtures';
import { enterEdit, addRoom } from './layout-helpers';
import { cameraPose, zoomCanvas } from './camera';

const geometry = page => page.locator('.map-room').evaluateAll(rooms => rooms.map(room => {
  const rect = room.getBoundingClientRect(), art = room.querySelector('.pixel-room-art').getBoundingClientRect();
  return { id: room.dataset.room, x: rect.x, y: rect.y, width: rect.width, height: rect.height, artWidth: art.width, artHeight: art.height };
}));
function sameGeometry(actual, expected) {
  expect(actual.length).toBe(expected.length);
  actual.forEach((room, i) => { expect(room.id).toBe(expected[i].id); for (const key of ['x', 'y', 'width', 'height', 'artWidth', 'artHeight']) expect(room[key], `${room.id} ${key}`).toBeCloseTo(expected[i][key], 1); });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }, { width: 844, height: 390 }]) {
  test(`entering and leaving Edit preserves room geometry at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const before = await geometry(page);
    await enterEdit(page);
    sameGeometry(await geometry(page), before);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    sameGeometry(await geometry(page), before);
    await enterEdit(page);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    sameGeometry(await geometry(page), before);
  });
}

test('Edit retains an existing zoom/pan and adding a room does not scale existing rooms', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await zoomCanvas(page, 1.5);
  await page.locator('.map-viewport').dispatchEvent('wheel', { deltaX: -40, deltaY: 25 });
  const before = await geometry(page), pose = await cameraPose(page);
  await enterEdit(page);
  sameGeometry(await geometry(page), before);
  expect(await cameraPose(page)).toEqual(pose);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await cameraPose(page)).toEqual(pose);
  await addRoom(page, 'Custom room');
  const after = await geometry(page);
  for (let i = 0; i < before.length; i++) {
    expect(after[i].width).toBeCloseTo(before[i].width, 1);
    expect(after[i].height).toBeCloseTo(before[i].height, 1);
  }
  const room = await page.locator('.map-room').last().boundingBox();
  expect(room.x).toBeGreaterThanOrEqual(0);
  expect(room.x + room.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  sameGeometry(await geometry(page), after);
});
