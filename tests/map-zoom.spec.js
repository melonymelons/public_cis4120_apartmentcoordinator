import { test, expect } from '@playwright/test';
import { initialState } from '../src/model.js';
import { resetCanvas, zoomCanvas, cameraPose } from './camera';

test.beforeEach(async ({ page }) => { await page.addInitScript(sample => { window.__NEST_SKIP_LOADING__ = true; if (!localStorage.getItem('roomie-v1')) localStorage.setItem('roomie-v1', JSON.stringify(sample)); }, initialState()); });

test('dots align with room edges through pan, zoom, and viewport changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  async function checkAlignment() {
    const geometry = await page.locator('.map-camera').evaluate(camera => {
      const grid = camera.parentElement.querySelector('.canvas-dots');
      const rect = grid.getBoundingClientRect();
      const style = getComputedStyle(grid);
      const [stepX, stepY] = style.backgroundSize.split(' ').map(parseFloat);
      const [offsetX, offsetY] = style.backgroundPosition.split(' ').map(parseFloat);
      const origin = { x: rect.x + offsetX + stepX / 2, y: rect.y + offsetY + stepY / 2 };
      const stride = Number(grid.dataset.stride);
      return {
        spacing: Math.min(stepX, stepY),
        background: style.backgroundImage,
        transform: style.transform,
        rooms: [...camera.querySelectorAll('.map-room')].map(room => {
          const box = room.getBoundingClientRect();
          return { x: (box.x - origin.x) / (stepX / stride), y: (box.y - origin.y) / (stepY / stride), w: box.width / (stepX / stride), h: box.height / (stepY / stride) };
        }),
      };
    });
    expect(geometry.background).not.toContain('linear-gradient');
    expect(geometry.background).toContain('0.9px');
    expect(geometry.transform).toBe('none');
    expect(geometry.spacing).toBeGreaterThanOrEqual(27.99);
    for (const room of geometry.rooms) for (const value of Object.values(room)) expect(value).toBeCloseTo(Math.round(value), 2);
  }
  await checkAlignment();
  await zoomCanvas(page, .25);
  await checkAlignment();
  await zoomCanvas(page, 3);
  await checkAlignment();
  await zoomCanvas(page, 1.25);
  await page.locator('.map-viewport').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await checkAlignment();
  await page.setViewportSize({ width: 1280, height: 900 });
  await checkAlignment();
  await page.screenshot({ path: 'test-results/aligned-dot-grid.png' });
});

test('rooms land one by one with a settling bounce while the camera remains fitted', async ({ page }) => {
  // Pause each room so the short construction sequence can be inspected.
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.matches('.map-room')) animation.pause();
      return animation;
    };
  });
  await page.goto('/');
  const viewport = page.locator('.map-viewport');
  const camera = page.locator('.map-camera');
  await expect(viewport).toHaveAttribute('data-intro', 'playing');
  await expect.poll(() => page.locator('.map-room').evaluateAll(rooms => rooms.filter(room => room.getAnimations().some(a => a.effect.getTiming().duration === 600)).length)).toBe(5);
  const sequence = await page.locator('.map-room').evaluateAll(rooms => rooms.map(room => {
    const effect = room.getAnimations().find(a => a.effect.getTiming().duration === 600).effect;
    return { timing: effect.getTiming(), frames: effect.getKeyframes().map(frame => { const matrix = new DOMMatrix(frame.transform); return { y: matrix.f, zoom: matrix.a, opacity: frame.opacity }; }) };
  }).sort((a, b) => a.timing.delay - b.timing.delay));
  expect(sequence.map(room => room.timing.delay)).toEqual([0, 180, 360, 540, 720]);
  for (const room of sequence) {
    expect(room.timing.duration).toBe(600);
    expect(room.frames[0].y).toBeLessThan(-80);
    expect(Number(room.frames[0].opacity)).toBe(0);
    expect(room.frames.some(frame => frame.y > 0)).toBe(true);
    expect(room.frames.at(-1)).toEqual({ y: 0, zoom: 1, opacity: '1' });
  }
  expect(await camera.evaluate(el => el.getAnimations().length)).toBe(0);
  expect(await cameraPose(page)).toEqual({ x: 0, y: 0, zoom: 1 });
  await page.locator('.map-room').evaluateAll(rooms => rooms.forEach(room => { room.getAnimations().find(a => a.effect.getTiming().duration === 600).currentTime = 620; }));
  await page.screenshot({ path: 'test-results/room-construction-intro.png' });
  await page.locator('.map-room').evaluateAll(rooms => rooms.forEach(room => room.getAnimations().find(a => a.effect.getTiming().duration === 600).play()));
  await expect(viewport).toHaveAttribute('data-intro', 'complete');
  expect(await page.locator('.map-room').evaluateAll(rooms => rooms.every(room => getComputedStyle(room).visibility === 'visible' && getComputedStyle(room).opacity === '1'))).toBe(true);
  await page.reload();
  await expect.poll(() => page.locator('.map-room').evaluateAll(rooms => rooms.filter(room => room.getAnimations().some(a => a.effect.getTiming().duration === 600)).length)).toBe(5);
  await page.keyboard.press('Escape');
  await expect(viewport).toHaveAttribute('data-intro', 'complete');
  expect(await page.locator('.map-room').evaluateAll(rooms => rooms.every(room => room.getAnimations().length === 0))).toBe(true);
});

test('interacting while artwork decodes reveals every room immediately', async ({ page }) => {
  await page.addInitScript(() => { HTMLImageElement.prototype.decode = () => new Promise(() => {}); });
  await page.goto('/');
  await expect(page.locator('.map-viewport')).toHaveAttribute('data-intro', 'playing');
  await resetCanvas(page);
  await expect(page.locator('.map-viewport')).toHaveAttribute('data-intro', 'complete');
  expect(await page.locator('.map-room').evaluateAll(rooms => rooms.every(room => getComputedStyle(room).visibility === 'visible' && getComputedStyle(room).opacity === '1'))).toBe(true);
  const kitchen = page.getByRole('button', { name: 'Open Kitchen', exact: true });
  await kitchen.click({ position: { x: 10, y: await kitchen.evaluate(el => el.clientHeight - 12) } });
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Kitchen', exact: true })).toBeVisible();
});

test('pinch zoom, panning, keyboard reset, room taps, and task drops work together without changing the saved layout', async ({ page }) => {
  await page.goto('/');
  await resetCanvas(page);
  await page.evaluate(() => document.fonts.ready);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).rooms);
  await zoomCanvas(page, 1.25);
  expect((await cameraPose(page)).zoom).toBeCloseTo(1.25, 5);
  const camera = page.locator('.map-camera');
  const bounds = await page.locator('.map-viewport').boundingBox();
  await page.mouse.move(bounds.x + 24, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 85, bounds.y + bounds.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  expect(await camera.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).e)).toBeGreaterThan(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Kitchen', exact: true }).click({ position: { x: 35, y: 30 } });
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Kitchen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await resetCanvas(page);
  expect((await cameraPose(page)).zoom).toBeCloseTo(1, 5);
  await zoomCanvas(page, 1.25);
  const pin = page.getByRole('button', { name: 'Trash in Kitchen, needs attention' });
  const source = await pin.boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 18, source.y + source.height / 2);
  const tray = page.getByRole('group', { name: 'Maya, Unknown', exact: true });
  const target = await tray.locator('.tray-slot').boundingBox();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await expect(tray).toHaveClass(/drop-ready/);
  await page.mouse.up();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Suggest task' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).rooms)).toEqual(before);
});

test('reduced motion skips the introduction; gesture zoom clamps at 25–300% and ordinary scrolling is preserved', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.map-viewport')).toHaveAttribute('data-intro', 'complete');
  await zoomCanvas(page, .01);
  expect((await cameraPose(page)).zoom).toBe(.25);
  await zoomCanvas(page, 10);
  expect((await cameraPose(page)).zoom).toBe(3);
  await resetCanvas(page);
  const area = await page.locator('.map-viewport').boundingBox();
  await page.mouse.move(area.x + area.width / 2, area.y + 50);
  await page.mouse.wheel(0, 150);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect((await cameraPose(page)).zoom).toBeCloseTo(1, 5);
});

test('trackpad-style pinch zoom stays inside the canvas and fit survives a viewport resize', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const area = page.locator('.map-viewport');
  const box = await area.boundingBox();
  await area.dispatchEvent('wheel', { ctrlKey: true, deltaY: -100, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
  await expect.poll(async () => (await cameraPose(page)).zoom).toBeCloseTo(Math.exp(.7), 4);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(area).toHaveClass(/is-zoomed/);
  await resetCanvas(page);
  expect((await cameraPose(page)).zoom).toBeCloseTo(1, 5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const camera = await page.locator('.map-camera').boundingBox();
  const viewport = await area.boundingBox();
  expect(camera.x).toBeGreaterThanOrEqual(viewport.x);
  expect(camera.x + camera.width).toBeLessThanOrEqual(viewport.x + viewport.width);
});

test.describe('touch camera', () => {
  test.use({ hasTouch: true });
  test('dragging a room at 100% moves the canvas and its grid, then Fit recenters it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const camera = page.locator('.map-camera');
    const box = await camera.boundingBox();
    const gridBefore = await page.locator('.canvas-grid').boundingBox();
    const client = await page.context().newCDPSession(page);
    const start = { x: box.x + box.width * .3, y: box.y + box.height * .8 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    for (let i = 1; i <= 6; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + i * 10, y: start.y - i * 8, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect((await cameraPose(page)).zoom).toBeCloseTo(1, 5);
    const pan = await camera.evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return { x: m.e, y: m.f }; });
    expect(pan.x).toBeGreaterThan(40);
    expect(pan.y).toBeLessThan(-30);
    const gridAfter = await page.locator('.canvas-grid').boundingBox();
    expect(gridAfter.x - gridBefore.x).toBeCloseTo(pan.x, 1);
    expect(gridAfter.y - gridBefore.y).toBeCloseTo(pan.y, 1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: 'test-results/mobile-free-canvas.png' });
    await resetCanvas(page);
    expect(await camera.evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return [m.e, m.f]; })).toEqual([0, 0]);
    await page.getByRole('button', { name: 'Open Kitchen', exact: true }).tap({ position: { x: 90, y: 35 } });
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Kitchen', exact: true })).toBeVisible();
  });

  test('a pinch starting on a task icon zooms instead of assigning or opening the task', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const source = await page.getByRole('button', { name: 'Trash in Kitchen, needs attention' }).boundingBox();
    const start = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }, { x: start.x + 70, y: start.y, id: 2 }] });
    for (let i = 1; i <= 6; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - i * 5, y: start.y, id: 1 }, { x: start.x + 70 + i * 5, y: start.y, id: 2 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.map-viewport')).toHaveClass(/is-zoomed/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/task-dragging/);
  });

  test('pinch zooms the map and a one-finger drag pans it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const box = await page.locator('.map-camera').boundingBox();
    const client = await page.context().newCDPSession(page);
    const y = box.y + box.height * .72;
    const center = box.x + box.width / 2;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: center - 35, y, id: 1 }, { x: center + 35, y, id: 2 }] });
    for (let i = 1; i <= 8; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center - 35 - i * 5, y, id: 1 }, { x: center + 35 + i * 5, y, id: 2 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.map-viewport')).toHaveClass(/is-zoomed/);
    expect((await cameraPose(page)).zoom).toBeGreaterThan(1.5);
    const before = await page.locator('.map-camera').evaluate(el => getComputedStyle(el).transform);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: center, y, id: 3 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center - 60, y: y - 30, id: 3 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await page.locator('.map-camera').evaluate(el => getComputedStyle(el).transform)).not.toBe(before);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/map-touch-zoom.png' });
  });
});

test('room entrances recover when artwork decoding never resolves', async ({ page }) => {
  await page.addInitScript(() => { HTMLImageElement.prototype.decode = () => new Promise(() => {}); });
  await page.goto('/');
  await expect(page.locator('.map-viewport')).toHaveAttribute('data-intro', 'playing');
  await expect(page.locator('.map-viewport')).toHaveAttribute('data-intro', 'complete', { timeout: 6000 });
  expect(await page.locator('.map-room').evaluateAll(rooms => rooms.length === 5 && rooms.every(room => getComputedStyle(room).visibility === 'visible'))).toBe(true);
});

test('a browser-cancelled room entrance reveals all rooms without changing tabs', async ({ page }) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.matches('.map-room')) {
        animation.pause();
        if (this.dataset.room === 'kitchen') setTimeout(() => animation.cancel(), 100);
      }
      return animation;
    };
  });
  await page.goto('/');
  await expect(page.locator('.map-viewport')).toHaveAttribute('data-intro', 'complete');
  await expect.poll(() => page.locator('.map-room').evaluateAll(rooms => rooms.length === 5 && rooms.every(room => getComputedStyle(room).visibility === 'visible' && getComputedStyle(room).opacity === '1'))).toBe(true);
});
