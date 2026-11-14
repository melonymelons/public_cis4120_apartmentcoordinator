import { test, expect } from './fixtures';
import { enterEdit } from './layout-helpers';
import { zoomCanvas } from './camera';

for (const width of [390, 1280]) {
  test(`objects follow room resizing, zoom, and the enlarged room at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const pin = page.locator('.map-camera [data-object="trash1"]');
    const room = page.locator('.map-camera [data-room="kitchen"]');
    const start = await pin.boundingBox();
    await zoomCanvas(page, 2);
    expect((await pin.boundingBox()).width / start.width).toBeCloseTo(2, 1);
    await zoomCanvas(page, .5);
    expect((await pin.boundingBox()).width / start.width).toBeCloseTo(.5, 1);
    await zoomCanvas(page, 1);
    const beforeWidth = await room.evaluate(el => el.clientWidth);
    await enterEdit(page);
    await page.getByRole('button', { name: 'Resize Kitchen', exact: true }).press('ArrowLeft');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const after = await pin.boundingBox(), afterWidth = await room.evaluate(el => el.clientWidth);
    expect(after.width).toBeLessThan(start.width);
    expect(after.width / start.width).toBeCloseTo(afterWidth / beforeWidth, 2);
    await page.getByRole('button', { name: 'Open Kitchen', exact: true }).click({ position: { x: 10, y: 10 } });
    const dialog = page.getByRole('dialog');
    const enlargedPin = dialog.locator('[data-object="trash1"]');
    const enlargedRoom = dialog.locator('[data-room="kitchen"]');
    await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const enlargedWidth = await enlargedRoom.evaluate(el => el.clientWidth);
    expect((await enlargedPin.boundingBox()).width / enlargedWidth).toBeCloseTo(after.width / afterWidth, 2);
    const supply = dialog.locator('.supply-map-pin').first();
    await expect(supply).toBeVisible();
    expect((await supply.boundingBox()).width).toBeGreaterThan(after.width);
    await dialog.screenshot({ path: `test-results/relative-items-${width}.png` });
  });
}
