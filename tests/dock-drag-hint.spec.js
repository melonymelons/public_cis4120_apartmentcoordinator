import { test, expect } from './fixtures';
import { initialState } from '../src/model';

const dockFor = page => page.getByRole('complementary', { name: 'Roommate availability dock' });
async function openDock(page) {
  await dockFor(page).getByRole('button', { name: 'Expand availability', exact: true }).click();
}

test('layout scrolling during expansion does not cancel the opening tutorial', async ({ page }) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.classList.contains('availability-dock')) animation.pause();
      return animation;
    };
  });
  await page.goto('/'); await openDock(page);
  await dockFor(page).locator('.dock-trays').dispatchEvent('scroll');
  await dockFor(page).evaluate(el => el.getAnimations()[0].finish());
  await expect(page.locator('.dock-drag-hint')).toBeVisible();
  await expect(page.locator('.home-grid')).toHaveClass(/is-task-hint/);
});

for (const width of [390, 1280]) test(`opening the dock briefly spotlights unassigned tasks and demonstrates dragging at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  await openDock(page);
  await expect(page.locator('.dock-drag-hint')).toBeVisible();
  await expect(page.locator('.home-grid')).toHaveClass(/is-task-hint/);
  await expect(page.locator('[data-object="trash1"]')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-object="dishes1"]')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-item="stock-paper"]')).toHaveCSS('opacity', '0.15');
  await expect(page.getByRole('switch', { name: 'Focus items' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('[data-person="maya"] .tray-slot')).toHaveClass(/task-hint-target/);
  await page.locator('.task-hint-ghost').evaluate(el => { const animation = el.getAnimations()[0]; animation.pause(); animation.currentTime = 1000; });
  await page.screenshot({ path: `test-results/dock-drag-hint-${width}.png` });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')))).toEqual(before);
  await expect(page.locator('.dock-drag-hint')).toHaveCount(0);
  await expect(page.locator('.home-grid')).not.toHaveClass(/is-task-hint/);
  await expect(page.locator('[data-object="dishes1"]')).toHaveCSS('opacity', '1');
  await expect(dockFor(page)).toHaveClass(/expanded/);
});

test('starting a real drag cancels the hint without moving the drop targets', async ({ page }) => {
  await page.goto('/'); await openDock(page);
  await expect(page.locator('.dock-drag-hint')).toBeVisible();
  const pin = page.locator('[data-object="trash1"]');
  const from = await pin.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await expect(page.locator('.dock-drag-hint')).toHaveCount(0);
  const target = await dockFor(page).locator('[data-person="maya"] .tray-slot').boundingBox();
  await page.mouse.move(from.x + from.width / 2 + 18, from.y + from.height / 2);
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Suggest task' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Maya/ })).toHaveAttribute('aria-pressed', 'true');
});

test('the hint preserves manual focus and cancels on canvas interaction', async ({ page }) => {
  await page.goto('/');
  const focus = page.getByRole('switch', { name: 'Focus items' });
  await focus.click();
  await openDock(page);
  await expect(page.locator('.home-grid')).toHaveClass(/is-task-hint/);
  await page.locator('.map-viewport').dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'mouse', button: 0, clientX: 8, clientY: 120 });
  await expect(page.locator('.home-grid')).not.toHaveClass(/is-task-hint/);
  await expect(focus).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.is-items-focused')).toHaveCount(1);
  await expect(dockFor(page)).toHaveClass(/expanded/);
});

test('reduced motion shows static guidance, and an apartment without unassigned work skips the hint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await openDock(page);
  await expect(page.locator('.home-grid')).toHaveClass(/is-task-hint/);
  await expect(page.locator('.dock-drag-hint')).toHaveCount(0);
  await expect(page.locator('.task-hint-target')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.home-grid')).not.toHaveClass(/is-task-hint/);
  const state = initialState();
  state.tasks = state.tasks.filter(task => task.status !== 'open');
  await page.evaluate(value => localStorage.setItem('roomie-v1', JSON.stringify(value)), state);
  await page.reload(); await openDock(page);
  await expect(page.locator('.home-grid')).not.toHaveClass(/is-task-hint/);
  await expect(page.locator('.task-hint-target')).toHaveCount(0);
});

test('a background household refresh does not swallow the tutorial', async ({ page }) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.classList.contains('availability-dock')) animation.pause();
      return animation;
    };
  });
  await page.goto('/'); await openDock(page);
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'roomie-v1', newValue: localStorage.getItem('roomie-v1') })));
  await dockFor(page).evaluate(el => el.getAnimations()[0].finish());
  await expect(page.locator('.dock-drag-hint')).toBeVisible();
});

test('a task covered by the dock never creates a tutorial copy from empty canvas', async ({ page }) => {
  const state = initialState();
  state.tasks = state.tasks.filter(task => task.id === 'task-supplies');
  await page.addInitScript(value => {
    localStorage.setItem('roomie-v1', JSON.stringify(value));
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.classList.contains('availability-dock')) animation.pause();
      return animation;
    };
  }, state);
  await page.goto('/'); await openDock(page);
  await dockFor(page).evaluate(el => {
    el.getAnimations()[0].finish();
    const dock = el.getBoundingClientRect();
    const pin = document.querySelector('[data-object="supplies1"]');
    const box = pin.getBoundingClientRect(), scale = box.width / pin.offsetWidth;
    const dx = dock.x + dock.width / 2 - box.x - box.width / 2;
    const dy = dock.y + dock.height / 2 - box.y - box.height / 2;
    pin.style.setProperty('animation', 'none', 'important');
    pin.style.setProperty('transform', `translate(${dx / scale}px, ${dy / scale}px)`, 'important');
  });
  await expect(page.locator('.dock-drag-hint')).toHaveCount(0);
  await expect(page.locator('.task-hint-source')).toHaveCount(0);
});

test('dock layout scrolling after opening does not dismiss the visible tutorial', async ({ page }) => {
  await page.goto('/'); await openDock(page);
  await expect(page.locator('.dock-drag-hint')).toBeVisible();
  await dockFor(page).locator('.dock-trays').dispatchEvent('scroll');
  await expect(page.locator('.dock-drag-hint')).toBeVisible();
  await expect(page.locator('.home-grid')).toHaveClass(/is-task-hint/);
});

test('a local code refresh can restart an interrupted opening hint', async ({ page }) => {
  await page.goto('/');
  // React development refresh re-runs effects while retaining refs/state.
  // StrictMode's initial effect replay has the same cleanup/setup sequence.
  await page.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: DockDragHint } = await import('/src/DockDragHint.jsx');
    const value = JSON.parse(localStorage.getItem('roomie-v1'));
    const dock = document.querySelector('.availability-dock');
    dock.classList.replace('collapsed', 'expanded');
    const mount = document.createElement('div');
    document.body.append(mount);
    window.hintTestRoot = ReactDOM.createRoot(mount);
    window.hintTestRoot.render(React.createElement(React.StrictMode, null, React.createElement(DockDragHint, { run: 1, state: value, disabled: false, onActive: () => {} })));
  });
  await expect(page.locator('.dock-drag-hint')).toBeVisible();
});


for (const focusEnabled of [false, true]) test(`yellow tasks stay sharp with Focus ${focusEnabled ? 'on' : 'off'}`, async ({ page }) => {
  const state = initialState();
  state.tasks = state.tasks.map(task => ({ ...task, attention: false }));
  state.inventory = []; // Isolate yellow tasks from pink low-stock alerts.
  await page.setViewportSize({ width: 440, height: 956 });
  await page.addInitScript(value => localStorage.setItem('roomie-v1', JSON.stringify(value)), state);
  await page.goto('/');
  if (focusEnabled) await page.getByRole('switch', { name: 'Focus items' }).click();
  const before = await page.evaluate(() => localStorage.getItem('roomie-v1'));
  await openDock(page);
  await expect(page.locator('.dock-drag-hint')).toBeVisible();
  await expect(page.locator('.home-grid')).toHaveClass(/is-task-hint/);
  const pin = page.locator('[data-object="trash1"]');
  await expect(pin).toHaveCSS('opacity', '1');
  await expect(pin).toHaveCSS('filter', 'none');
  await expect(page.locator('[data-object="supplies1"]')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-object="supplies1"]')).toHaveCSS('filter', 'none');
  await expect(page.locator('[data-object="dishes1"]')).toHaveCSS('opacity', '1');
  const source = page.locator('.task-hint-source');
  const box = await source.boundingBox();
  const path = await page.locator('.task-hint-path path').getAttribute('d');
  const [, x, y] = path.match(/^M ([\d.-]+) ([\d.-]+)/);
  expect(Number(x)).toBeCloseTo(box.x + box.width / 2, 1);
  expect(Number(y)).toBeCloseTo(box.y + box.height / 2, 1);
  const fill = await pin.evaluate(el => getComputedStyle(el).backgroundColor);
  await expect(page.locator('.task-hint-ghost')).toHaveCSS('background-color', fill);
  await page.locator('.task-hint-ghost').evaluate(el => { const animation = el.getAnimations()[0]; animation.pause(); animation.currentTime = 1000; });
  await page.screenshot({ path: `test-results/dock-yellow-hint-focus-${focusEnabled}.png` });
  expect(await page.evaluate(() => localStorage.getItem('roomie-v1'))).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dock-drag-hint')).toHaveCount(0);
  await expect(page.locator('.home-grid')).not.toHaveClass(/is-task-hint/);
});


test('mixed task markers stay sharp while inventory is excluded from the dock hint', async ({ page }) => {
  const state = initialState();
  state.tasks[0].attention = false;
  state.inventory = state.inventory.filter(item => item.objectId !== 'trash1');
  state.tasks.push({ id: 'assigned-cleaning', objectId: 'cleaning1', title: 'Clean floor', status: 'assigned', from: 'jess', to: 'maya' });
  await page.setViewportSize({ width: 440, height: 956 });
  await page.addInitScript(value => localStorage.setItem('roomie-v1', JSON.stringify(value)), state);
  await page.goto('/'); await openDock(page);
  await expect(page.locator('.home-grid')).toHaveClass(/is-task-hint/);
  for (const selector of ['[data-object="trash1"]', '[data-object="dishes1"]', '[data-object="supplies1"]']) {
    await expect(page.locator(selector)).toHaveCSS('opacity', '1');
    await expect(page.locator(selector)).toHaveCSS('filter', 'none');
  }
  await expect(page.locator('[data-object="cleaning1"]')).toHaveCSS('opacity', '0.15');
  for (const id of ['stock-soap', 'stock-paper']) {
    await expect(page.locator(`[data-item="${id}"]`)).toHaveCSS('opacity', '0.15');
    await expect(page.locator(`[data-item="${id}"]`)).not.toHaveClass(/floating-marker|task-hint-source/);
  }
  await page.locator('.task-hint-ghost').evaluate(el => { const animation = el.getAnimations()[0]; animation.pause(); animation.currentTime = 1000; });
  await page.screenshot({ path: 'test-results/dock-mixed-marker-visibility.png' });
});

test('a yellow task near the dock starts from the real marker rather than a shifted point', async ({ page }) => {
  const state = initialState();
  state.tasks = [{ ...state.tasks[0], attention: false }];
  state.inventory = [];
  await page.addInitScript(value => {
    localStorage.setItem('roomie-v1', JSON.stringify(value));
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.classList.contains('availability-dock')) animation.pause();
      return animation;
    };
  }, state);
  await page.goto('/'); await openDock(page);
  await dockFor(page).evaluate(el => {
    el.getAnimations()[0].finish();
    const dock = el.getBoundingClientRect();
    const pin = document.querySelector('[data-object="trash1"]');
    const box = pin.getBoundingClientRect(), scale = box.width / pin.offsetWidth;
    pin.style.setProperty('transform', `translate(0px, ${(dock.top - 6 - box.bottom) / scale}px)`, 'important');
  });
  await expect(page.locator('.dock-drag-hint')).toBeVisible();
  const box = await page.locator('.task-hint-source').boundingBox();
  const path = await page.locator('.task-hint-path path').getAttribute('d');
  const [, x, y] = path.match(/^M ([\d.-]+) ([\d.-]+)/);
  expect(Number(x)).toBeCloseTo(box.x + box.width / 2, 1);
  expect(Number(y)).toBeCloseTo(box.y + box.height / 2, 1);
});
