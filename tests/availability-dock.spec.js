import { test, expect } from './fixtures';

test('anywhere on the collapsed dock opens availability before roommate details', async ({ page }) => {
  await page.goto('/');
  const dock = page.getByRole('complementary', { name: 'Roommate availability dock' });
  const roommate = dock.getByRole('button', { name: 'Availability: Maya, Unknown', exact: true });
  await roommate.click();
  await expect(dock).toHaveClass(/expanded/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await roommate.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Collapse availability' }).click();
  await dock.click({ position: { x: 5, y: 5 } });
  await expect(dock).toHaveClass(/expanded/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Collapse availability' }).click();
  await page.getByRole('button', { name: 'Expand availability' }).press('Enter');
  await expect(dock).toHaveClass(/expanded/);
});

test('manually expanded availability stays open through canvas gestures until dismissed', async ({ page }) => {
  await page.goto('/');
  const dock = page.getByRole('complementary', { name: 'Roommate availability dock' });
  await page.getByRole('button', { name: 'Expand availability' }).click();
  await expect(dock).toHaveClass(/expanded/);
  await page.mouse.move(180, 25);
  await page.mouse.down();
  await page.mouse.move(245, 45, { steps: 6 });
  await page.mouse.up();
  await expect(dock).toHaveClass(/expanded/);
  await page.locator('.map-viewport').dispatchEvent('wheel', { ctrlKey: true, deltaY: -100, clientX: 180, clientY: 250 });
  await expect(page.locator('.map-viewport')).toHaveClass(/is-zoomed/);
  await expect(dock).toHaveClass(/expanded/);
  await page.getByRole('button', { name: 'Collapse availability' }).click();
  await expect(dock).toHaveClass(/collapsed/);
  await page.getByRole('button', { name: 'Expand availability' }).click();
  await page.keyboard.press('Escape');
  await expect(dock).toHaveClass(/collapsed/);
});
