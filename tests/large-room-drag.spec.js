import { test, expect } from './fixtures';
import { addRoom, seedEmptyApartment, dragRoom, enterEdit } from './layout-helpers';
import { zoomCanvas } from './camera';

for (const touch of [false, true]) {
  test.describe(touch ? 'touch' : 'mouse', () => {
    test.use({ hasTouch: touch });
    test('an enlarged room moves above the old top edge and stays there after saving and reload', async ({ page }) => {
      await seedEmptyApartment(page);
      await page.goto('/');
      await addRoom(page, 'Custom room');
      const handle = page.getByRole('button', { name: 'Resize Custom room', exact: true });
      for (let i = 0; i < 4; i++) { await handle.press('ArrowRight'); await handle.press('ArrowDown'); }
      await zoomCanvas(page, touch ? .75 : 1);
      const id = await page.locator('.map-room').getAttribute('data-room');
      await dragRoom(page, id, 0, -4, touch);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await page.waitForTimeout(180);
      const before = await page.locator('.map-room').boundingBox();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      const after = await page.locator('.map-room').boundingBox();
      for (const key of ['x', 'y', 'width', 'height']) expect(after[key]).toBeCloseTo(before[key], 1);
      const state = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
      expect(state.rooms[0]).toMatchObject({ x: 0, y: -4, w: 8, h: 8 });
      expect(state.canvas.minY).toBe(-4);
      await page.reload();
      await enterEdit(page);
      await dragRoom(page, id, 0, 2, touch);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).rooms[0].y)).toBe(-2);
    });
  });
}
