import { enterEdit } from './layout-helpers';
import { test, expect, openAvailabilityDetails } from './fixtures';

async function settledBounds(dialog) {
  await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))); });
  return dialog.boundingBox();
}

async function sameBounds(dialog, initial) {
  const current = await settledBounds(dialog);
  if (await dialog.evaluate(el => el.classList.contains('household-modal'))) {
    expect(current.width).toBeLessThanOrEqual(initial.width);
    expect(current.height).toBeLessThan(initial.height);
    return;
  }
  if (await dialog.evaluate(el => el.classList.contains('object-modal'))) {
    expect(current.width).toBeCloseTo(initial.width, 0);
    expect(current.height).toBeLessThanOrEqual(await dialog.evaluate(() => innerHeight - 32));
    return;
  }
  for (const key of ['x', 'y', 'width', 'height']) expect(current[key], key).toBeCloseTo(initial[key], 0);
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`popup dimensions stay fixed through tabs and forms at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await openAvailabilityDetails(page, 'Availability: Jessalyn, Unknown');
    const dialog = page.getByRole('dialog');
    const initial = await settledBounds(dialog);
    await dialog.getByRole('tab', { name: 'Weekly routine' }).click();
    await sameBounds(dialog, initial);
    await dialog.getByRole('button', { name: 'Add recurring window' }).click();
    await sameBounds(dialog, initial);
    await dialog.getByLabel('End time').fill('18:00');
    await dialog.getByRole('button', { name: 'Save window' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await sameBounds(dialog, initial);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog.getByRole('tab', { name: 'Right now' }).click();
    await sameBounds(dialog, initial);
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await page.getByRole('button', { name: 'Trash in Kitchen, needs attention' }).click();
    await sameBounds(dialog, initial);
    await expect(dialog.getByRole('button', { name: 'Edit object' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Edit task', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Delete task', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Add task', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Suggest to a roommate' }).click();
    await sameBounds(dialog, initial);
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await enterEdit(page);
    await page.getByRole('button', { name: 'Add task' }).click();
    const objectBounds = await settledBounds(dialog);
    expect(objectBounds.width).toBeLessThanOrEqual(initial.width);
    expect(objectBounds.height).toBeLessThan(initial.height);
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    const navigation = page.getByRole('navigation', { name: viewport.width > 640 ? 'Main navigation' : 'Mobile navigation', exact: true });
    await navigation.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'The little apartment', exact: true }).click();
    await sameBounds(dialog, initial);
  });
}

test('the room picker keeps its size as rooms are added to the canvas', async ({ page }) => {
  await page.goto('/');
  await enterEdit(page);
  await page.getByRole('button', { name: 'Add room', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const initial = await settledBounds(dialog);
  for (const type of ['Kitchen', 'Bedroom', 'Bathroom']) {
    await sameBounds(dialog, initial);
    await dialog.getByRole('button', { name: `Add ${type}`, exact: true }).click();
    await enterEdit(page);
    await page.getByRole('button', { name: 'Add room', exact: true }).click();
  }
  await sameBounds(dialog, initial);
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeInViewport();
});

test('short viewports constrain the popup and keep its close control accessible', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 568 });
  await page.goto('/');
  await enterEdit(page);
  await page.getByRole('button', { name: 'Add task' }).click();
  const dialog = page.getByRole('dialog');
  const bounds = await dialog.boundingBox();
  expect(bounds.height).toBeLessThanOrEqual(536);
  expect(bounds.y).toBeGreaterThanOrEqual(16);
  await dialog.getByLabel('Task name').fill('Recycling');
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeInViewport();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).toHaveCount(0);
});
