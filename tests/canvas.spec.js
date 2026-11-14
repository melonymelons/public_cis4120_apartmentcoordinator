import { test, expect } from './fixtures';
import { addRoom } from './layout-helpers';

test('adding rooms grows the canvas automatically and preserves existing room sizes', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  for (let i = 0; i < 8; i++) await addRoom(page, 'Bedroom');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  expect(after.rooms.length).toBe(13);
  expect(after.rooms.slice(0, 5)).toEqual(before.rooms);
  expect(after.canvas.rows).toBeGreaterThan(14);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')))).rooms.length).toBe(13);
});

test('Cancel restores the apartment after the temporary workspace expands', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  await addRoom(page, 'Living room');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  expect(after).toEqual(before);
  await expect(page.locator('.map-camera > .map-canvas')).toHaveAttribute('data-cols', '12');
  await expect(page.locator('.map-camera > .map-canvas')).toHaveAttribute('data-rows', '14');
});

test('keyboard movement and corner resizing work without a separate layout popup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit apartment' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Move Jessalyn’s room', exact: true }).press('ArrowDown');
  await page.getByRole('button', { name: 'Resize Jessalyn’s room', exact: true }).press('ArrowDown');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const room = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).rooms.find(room => room.id === 'bedroom1'));
  expect(room.y).toBe(10);
  expect(room.h).toBe(6);
});
