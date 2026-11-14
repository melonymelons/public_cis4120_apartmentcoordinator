import { test, expect } from './fixtures';
import { zoomCanvas } from './camera';

for (const width of [390, 1280]) {
  test(`floating markers and Focus keep items usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).rooms);
    const focus = page.getByRole('switch', { name: 'Focus items', exact: true });
    const pin = page.locator('.map-camera [data-object="trash1"]');
    const art = page.locator('.map-camera [data-room="kitchen"] .pixel-room-scene');
    await expect(focus).toHaveAttribute('aria-checked', 'false');
    await expect(pin).toHaveClass(/floating-marker/);
    expect(await pin.evaluate(el => getComputedStyle(el, '::before').clipPath)).not.toBe('none');
    await expect(pin.locator('.room-task-label')).toHaveCount(0);
    await focus.click();
    await expect(focus).toHaveAttribute('aria-checked', 'true');
    await expect(art).toHaveCSS('opacity', '0.16');
    await expect(pin.locator('.room-task-label')).toHaveText('Trash');
    await zoomCanvas(page, 1.25);
    await page.locator('.map-viewport').dispatchEvent('wheel', { deltaX: -25, deltaY: 10 });
    await expect(focus).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ path: `test-results/item-focus-${width}.png`, animations: 'disabled' });
    await pin.click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Trash', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await focus.click();
    await expect(art).toHaveCSS('opacity', '0.8');
    await expect(pin.locator('.room-task-label')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).rooms)).toEqual(before);
  });
}
