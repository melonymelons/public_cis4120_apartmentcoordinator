import { test, expect } from './fixtures';
import { cameraPose, resetCanvas } from './camera';

const zoom = async page => (await cameraPose(page)).zoom;
async function pinch(page, { direction = 1, pause = 0, cancel = false } = {}) {
  return page.locator('.map-viewport').evaluate((el, options) => {
    el.setPointerCapture = () => {};
    const time = performance.now(), rect = el.getBoundingClientRect();
    const send = (type, id, x, at) => {
      const event = new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', button: 0, clientX: rect.x + rect.width / 2 + x, clientY: rect.y + rect.height / 2 });
      Object.defineProperty(event, 'timeStamp', { value: at }); el.dispatchEvent(event);
    };
    send('pointerdown', 9, -50, time); send('pointerdown', 10, 50, time);
    for (let i = 1; i <= 6; i++) {
      const distance = 50 + options.direction * i * 5;
      send('pointermove', 9, -distance, time + i * 20);
      send('pointermove', 10, distance, time + i * 20);
    }
    send(options.cancel ? 'pointercancel' : 'pointerup', 9, 0, time + 125 + options.pause);
    send(options.cancel ? 'pointercancel' : 'pointerup', 10, 0, time + 126 + options.pause);
    return new DOMMatrix(getComputedStyle(el.querySelector('.map-camera')).transform).a;
  }, { direction, pause, cancel });
}

test('wheel zoom eases after input stops, accumulates input, and Home interrupts it', async ({ page }) => {
  await page.goto('/');
  const area = page.locator('.map-viewport');
  await area.dispatchEvent('wheel', { ctrlKey: true, deltaY: -70, clientX: 195, clientY: 400 });
  const initial = await zoom(page), target = Math.exp(.49);
  expect(initial).toBeLessThan(target);
  await expect.poll(() => zoom(page)).toBeGreaterThan(initial);
  await expect.poll(() => zoom(page)).toBeCloseTo(target, 5);
  await area.dispatchEvent('wheel', { ctrlKey: true, deltaY: 70, clientX: 195, clientY: 400 });
  await expect.poll(() => zoom(page)).toBeCloseTo(1, 5);
  await area.evaluate(el => { for (let i = 0; i < 8; i++) el.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -5, clientX: 195, clientY: 400, bubbles: true, cancelable: true })); });
  await expect.poll(() => zoom(page)).toBeCloseTo(Math.exp(.28), 5);
  await area.dispatchEvent('wheel', { ctrlKey: true, deltaY: -80, clientX: 195, clientY: 400 });
  await resetCanvas(page);
  await page.waitForTimeout(250);
  expect(await zoom(page)).toBe(1);
});

for (const direction of [1, -1]) {
  test(`pinch ${direction > 0 ? 'in' : 'out'} noticeably coasts after release and settles`, async ({ page }) => {
    await page.goto('/');
    const released = await pinch(page, { direction });
    await expect.poll(async () => ((await zoom(page)) - released) * direction).toBeGreaterThan(.005);
    await page.waitForTimeout(1100);
    const settled = await zoom(page);
    expect(Math.abs(Math.log(settled / released))).toBeGreaterThan(.15);
    expect(Math.abs(Math.log(settled / released))).toBeLessThan(.33);
    await page.waitForTimeout(100);
    expect(await zoom(page)).toBeCloseTo(settled, 4);
    await resetCanvas(page);
    await pinch(page, { direction });
    await page.locator('.map-viewport').dispatchEvent('pointerdown', { pointerId: 20, pointerType: 'touch', button: 0 });
    const stopped = await zoom(page);
    await page.waitForTimeout(150);
    expect(await zoom(page)).toBe(stopped);
  });
}

test('held and cancelled pinches do not coast; reduced motion keeps zoom immediate', async ({ page }) => {
  await page.goto('/');
  for (const options of [{ pause: 150 }, { cancel: true }]) {
    await resetCanvas(page);
    const released = await pinch(page, options);
    await page.waitForTimeout(150);
    expect(await zoom(page)).toBe(released);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resetCanvas(page);
  const released = await pinch(page);
  await page.waitForTimeout(150);
  expect(await zoom(page)).toBe(released);
  await resetCanvas(page);
  await page.locator('.map-viewport').dispatchEvent('wheel', { ctrlKey: true, deltaY: -70 });
  expect(await zoom(page)).toBeCloseTo(Math.exp(.49), 5);
});
