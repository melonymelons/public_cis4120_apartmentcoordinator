import { test, expect } from './fixtures';
import { resetCanvas } from './camera';

async function flick(page, { pointerType = 'mouse', pause = 0, cancel = false } = {}) {
  return page.locator('.map-viewport').evaluate((el, options) => {
    const time = performance.now();
    const rect = el.getBoundingClientRect();
    const dispatch = (type, x, timestamp) => {
      const event = new PointerEvent(type, { bubbles: true, pointerId: 19, pointerType: options.pointerType, button: 0, clientX: rect.x + 20 + x, clientY: rect.y + rect.height / 2 });
      Object.defineProperty(event, 'timeStamp', { value: timestamp });
      // Synthetic pointers are not registered with the browser's capture API.
      el.dispatchEvent(event);
    };
    el.setPointerCapture = () => {};
    dispatch('pointerdown', 0, time);
    for (let i = 1; i <= 4; i++) dispatch('pointermove', i * 15, time + i * 20);
    dispatch(options.cancel ? 'pointercancel' : 'pointerup', 60, time + 80 + options.pause);
    return new DOMMatrix(getComputedStyle(el.querySelector('.map-camera')).transform).e;
  }, { pointerType, pause, cancel });
}

const offset = page => page.locator('.map-camera').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).e);

for (const pointerType of ['mouse', 'touch']) {
  test(`${pointerType} flick glides in the release direction, settles, and can be interrupted`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const released = await flick(page, { pointerType });
    await expect.poll(() => offset(page)).toBeGreaterThan(released + 20);
    await page.waitForTimeout(1100);
    const settled = await offset(page);
    await page.waitForTimeout(100);
    expect(await offset(page)).toBeCloseTo(settled, 1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await resetCanvas(page);
    await flick(page, { pointerType });
    await resetCanvas(page);
    await page.waitForTimeout(120);
    expect(await offset(page)).toBe(0);
    await flick(page, { pointerType });
    await page.locator('.map-viewport').dispatchEvent('pointerdown', { pointerId: 20, pointerType, button: 0 });
    const stopped = await offset(page);
    await page.waitForTimeout(120);
    expect(await offset(page)).toBe(stopped);
  });
}

test('holding before release, cancelled gestures, and reduced motion do not glide', async ({ page }) => {
  await page.goto('/');
  for (const options of [{ pause: 150 }, { cancel: true }]) {
    await resetCanvas(page);
    const released = await flick(page, options);
    await page.waitForTimeout(150);
    expect(await offset(page)).toBe(released);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const released = await flick(page);
  await page.waitForTimeout(150);
  expect(await offset(page)).toBe(released);
});
