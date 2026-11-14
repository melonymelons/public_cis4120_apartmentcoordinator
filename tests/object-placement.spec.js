import { test, expect } from './fixtures';
import { enterEdit } from './layout-helpers';

for (const touch of [false, true]) test.describe(touch ? 'touch placement' : 'mouse placement', () => {
  test.use({ hasTouch: touch });
  test('Back preserves details, dragging sets the position, and Confirm stages the object until Done', async ({ page }) => {
    await page.goto('/');
    await enterEdit(page);
    await page.getByRole('button', { name: 'Add task', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Task name').fill('Hand soap');
    await dialog.getByRole('combobox', { name: 'Room', exact: true }).click();
    await dialog.getByRole('option', { name: 'Bathroom', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add to apartment' }).click();
    await expect(dialog.getByRole('heading', { name: 'Place task' })).toBeVisible();
    await expect(dialog.locator('.modal-heading p')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(dialog.getByLabel('Task name')).toHaveValue('Hand soap');
    await expect(dialog.getByRole('combobox', { name: 'Room', exact: true })).toHaveText('Bathroom');
    await dialog.getByRole('button', { name: 'Add to apartment' }).click();
    const marker = dialog.getByRole('button', { name: 'Position Hand soap' });
    const board = await dialog.locator('.object-placement-board').boundingBox();
    const pin = await marker.boundingBox();
    const existing = await dialog.locator('.object-placement-preview .object-pin').first().boundingBox();
    expect(pin.width).toBeCloseTo(existing.width, 0);
    expect(pin.height).toBeCloseTo(existing.height, 0);
    const surface = await dialog.locator('.modal-surface').boundingBox();
    const actions = await dialog.locator('.object-placement-actions').boundingBox();
    expect(actions.y).toBeGreaterThan(surface.y + surface.height);
    const before = await marker.evaluate(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }));
    const start = { x: pin.x + pin.width / 2, y: pin.y + pin.height / 2 };
    const end = { x: start.x + (25 - before.x) * board.width / 100, y: start.y + (72 - before.y) * board.height / 100 };
    if (touch) {
      const client = await page.context().newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(start.x, start.y); await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 8 }); await page.mouse.up();
    }
    const placed = await marker.evaluate(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }));
    expect(placed.x).toBeCloseTo(25, 0);
    expect(placed.y).toBeCloseTo(72, 0);
    await dialog.screenshot({ path: `test-results/object-placement-${touch ? 'touch' : 'mouse'}.png` });
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).objects.some(o => o.name === 'Hand soap'))).toBe(false);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const added = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).objects.find(o => o.name === 'Hand soap'));
    expect(added).toMatchObject({ roomId: 'bathroom' });
    expect(added.x).toBeCloseTo(placed.x, 0);
    expect(added.y).toBeCloseTo(placed.y, 0);
  });
});

test('closing placement adds nothing and keyboard arrows can position an object', async ({ page }) => {
  await page.goto('/'); await enterEdit(page);
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task name').fill('Discarded');
  await dialog.getByRole('button', { name: 'Add to apartment' }).click();
  const marker = dialog.getByRole('button', { name: 'Position Discarded' });
  const before = await marker.evaluate(el => parseFloat(el.style.left));
  await marker.focus(); await marker.press('ArrowLeft');
  expect(await marker.evaluate(el => parseFloat(el.style.left))).toBeLessThan(before);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).objects.some(o => o.name === 'Discarded'))).toBe(false);
});
