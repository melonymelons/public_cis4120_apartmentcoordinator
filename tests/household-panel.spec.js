import { test, expect } from './fixtures';

for (const width of [320, 390, 1280]) test(`household naming panel is compact and supports save/cancel at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: width > 640 ? 'Main navigation' : 'Mobile navigation', exact: true });
  await nav.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'The little apartment', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); });
  const input = dialog.getByLabel('Household name');
  await expect(input).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Save household' })).toBeDisabled();
  expect((await dialog.boundingBox()).height).toBeLessThan(300);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.screenshot({ path: `test-results/household-panel-${width}.png` });
  await input.fill('   ');
  await expect(dialog.getByRole('button', { name: 'Save household' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'The little apartment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'The little apartment', exact: true }).click();
  await input.fill('Our place');
  await dialog.getByRole('button', { name: 'Save household' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Our place', exact: true })).toBeVisible();
  await page.reload();
  await nav.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Our place', exact: true })).toBeVisible();
});
