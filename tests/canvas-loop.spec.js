import { test, expect } from './fixtures';
import { resetCanvas, zoomCanvas } from './camera';

async function geometry(page) {
  return page.locator('.map-camera').evaluate(el => {
    const box = el.parentElement;
    const style = getComputedStyle(el);
    const zoom = new DOMMatrix(style.transform).a;
    const width = parseFloat(style.width), height = parseFloat(style.height);
    const cellX = width * zoom / Number(style.getPropertyValue('--grid-cols'));
    const cellY = height * zoom / Number(style.getPropertyValue('--grid-rows'));
    return {
      periodX: Math.ceil((box.clientWidth + width * zoom + 64) / cellX) * cellX,
      periodY: Math.ceil((box.clientHeight + height * zoom + 64) / cellY) * cellY,
      centerX: box.clientWidth / 2 - el.offsetLeft - width / 2,
      centerY: box.clientHeight / 2 - el.offsetTop - height / 2,
    };
  });
}

for (const width of [390, 1280]) {
  test(`only one apartment exists and wraps completely past each edge at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const area = page.locator('.map-viewport');
    const camera = page.locator('.map-camera');
    const viewport = await area.boundingBox();
    for (const axis of ['X', 'Y']) for (const direction of [-1, 1]) {
      await resetCanvas(page);
      const shape = await geometry(page);
      const edge = shape[`center${axis}`] + direction * shape[`period${axis}`] / 2;
      const delta = axis === 'X' ? 'deltaX' : 'deltaY';
      await area.dispatchEvent('wheel', { [delta]: -(edge - direction * 2) });
      const before = await camera.boundingBox();
      const start = axis === 'X' ? 'x' : 'y', size = axis === 'X' ? 'width' : 'height';
      if (direction > 0) expect(before[start]).toBeGreaterThan(viewport[start] + viewport[size]);
      else expect(before[start] + before[size]).toBeLessThan(viewport[start]);
      await area.dispatchEvent('wheel', { [delta]: -direction * 4 });
      const after = await camera.boundingBox();
      if (direction > 0) expect(after[start] + after[size]).toBeLessThan(viewport[start]);
      else expect(after[start]).toBeGreaterThan(viewport[start] + viewport[size]);
      await expect(page.locator('.map-viewport .map-canvas')).toHaveCount(1);
      await expect(page.locator('.map-viewport .map-room')).toHaveCount(5);
    }
    await resetCanvas(page);
    await page.getByRole('button', { name: 'Open Kitchen', exact: true }).click({ position: { x: 35, y: 35 } });
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Kitchen', exact: true })).toBeVisible();
  });
}

test('full loops return to the same position at different zoom levels without adding copies', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const zoom of [1, 1.25, 2]) {
    await resetCanvas(page);
    await zoomCanvas(page, zoom);
    const shape = await geometry(page);
    for (const direction of [-1, 1]) {
      await page.locator('.map-viewport').dispatchEvent('wheel', { deltaX: shape.periodX * 8 * direction, deltaY: shape.periodY * 6 * direction });
      const pan = await page.locator('.map-camera').evaluate(el => {
        const matrix = new DOMMatrix(getComputedStyle(el).transform);
        return [matrix.e, matrix.f];
      });
      expect(pan[0]).toBeCloseTo(0, 2);
      expect(pan[1]).toBeCloseTo(0, 2);
      await expect(page.locator('.map-viewport .map-canvas')).toHaveCount(1);
    }
  }
});
