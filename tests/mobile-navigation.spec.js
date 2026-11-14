import { test, expect } from './fixtures';

test('bottom navigation stays in place throughout presses and tab switches', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
  const original = await nav.boundingBox();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const name of ['Schedule', 'Inventory', 'To-dos', 'Profile', 'Apartment']) {
    const button = nav.getByRole('button', { name, exact: true });
    const rect = await button.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    expect(await nav.boundingBox()).toEqual(original);
    await expect(nav.locator('.button-ink')).toHaveCount(0);
    await page.mouse.up();
    await expect(button).toHaveAttribute('aria-current', 'page');
    expect(await nav.boundingBox()).toEqual(original);
  }
  expect(errors).toEqual([]);
});
