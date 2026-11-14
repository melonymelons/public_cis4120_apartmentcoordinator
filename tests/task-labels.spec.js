import { test, expect } from './fixtures';
import { initialState } from '../src/model';

for (const width of [390, 1280]) test(`map and enlarged room share task label text and typography at ${width}px`, async ({ page }) => {
  const state = initialState();
  state.objects[0].name = 'Kitchen trash';
  state.tasks[0].title = 'Take recycling downstairs';
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(value => localStorage.setItem('roomie-v1', JSON.stringify(value)), state);
  await page.goto('/');
  const pin = page.locator('.map-page [data-object="trash1"]');
  await expect(pin.locator('.room-task-label')).toHaveText('Take recycling downstairs');
  await expect(pin.locator('.object-name-label')).toHaveCount(0);
  const style = label => label.evaluate(el => {
    const s = getComputedStyle(el);
    return { family: s.fontFamily, weight: s.fontWeight, color: s.color, background: s.backgroundColor, border: s.borderColor, radius: s.borderRadius, lineRatio: parseFloat(s.lineHeight) / parseFloat(s.fontSize) };
  });
  const before = await style(pin.locator('.room-task-label'));
  await page.getByRole('switch', { name: 'Focus items' }).click();
  await expect(pin.locator('.room-task-label')).toHaveText('Take recycling downstairs');
  await page.getByRole('button', { name: 'Open Kitchen', exact: true }).click();
  const roomLabel = page.getByRole('dialog').locator('[data-object="trash1"] .room-task-label');
  await expect(roomLabel).toHaveText('Take recycling downstairs');
  const after = await style(roomLabel);
  expect(after.family).toBe(before.family);
  expect(after.weight).toBe(before.weight);
  expect(after.color).toBe(before.color);
  expect(after.background).toBe(before.background);
  expect(after.border).toBe(before.border);
  expect(after.radius).toBe(before.radius);
  expect(after.lineRatio).toBeCloseTo(before.lineRatio, 1);
});
