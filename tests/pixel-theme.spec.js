import { enterEdit } from './layout-helpers';
import { test, expect } from './fixtures';
import { resetCanvas } from './camera';

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`pixel rooms and game panels render and remain interactive at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect((await page.locator('.map-viewport').boundingBox()).y).toBe(0);
    // Empty space beside the floating brand belongs to the draggable canvas.
    expect(await page.evaluate(() => Boolean(document.elementFromPoint(innerWidth / 2, 25)?.closest('.map-viewport')))).toBe(true);
    await page.mouse.move(viewport.width / 2, 25);
    await page.mouse.down();
    await page.mouse.move(viewport.width / 2 + 40, 25, { steps: 4 });
    await page.mouse.up();
    expect(await page.locator('.map-camera').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).e)).toBeGreaterThan(20);
    await resetCanvas(page);
    const artwork = page.locator('.map-camera > .map-canvas .pixel-room-art');
    await expect(artwork).toHaveCount(5);
    await expect.poll(() => artwork.evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: `test-results/pixel-home-${viewport.width}.png`, animations: 'disabled' });
    await page.getByRole('button', { name: 'Expand availability' }).click();
    await expect(page.getByRole('complementary', { name: 'Roommate availability dock' })).toHaveClass(/expanded/);
    await page.screenshot({ path: `test-results/pixel-dock-${viewport.width}.png`, animations: 'disabled' });
    await page.getByRole('button', { name: 'Collapse availability' }).click();
    await page.getByRole('button', { name: 'Open Kitchen', exact: true }).click({ position: { x: 35, y: 25 } });
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.pixel-room-art')).toHaveCount(1);
    await expect(dialog.getByText('Take out the trash', { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/pixel-room-${viewport.width}.png`, animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await enterEdit(page);
    await page.getByRole('button', { name: 'Add room', exact: true }).click();
    await expect(dialog.locator('.pixel-room-art')).toHaveCount(7);
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
