import { test, expect } from './fixtures';

test('attention hops follow open tasks and stock levels, and respect reduced motion', async ({ page }) => {
  await page.goto('/');
  const trash = page.locator('.object-pin[data-object="trash1"]');
  await expect(trash).toHaveCSS('animation-name', 'attention-hop');
  await expect(page.locator('.object-pin[data-object="dishes1"]')).toHaveCSS('animation-name', 'none');
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Inventory' }).click();
  const bags = page.getByRole('article', { name: 'Trash bags', exact: true });
  await expect(bags.locator('.inventory-item-icon')).toHaveCSS('animation-name', 'attention-hop');
  await page.getByRole('button', { name: 'Edit Trash bags', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Quantity (optional)').fill('5');
  await page.getByRole('dialog').getByRole('button', { name: 'Save item' }).click();
  await expect(bags.locator('.inventory-item-icon')).not.toHaveCSS('animation-name', 'attention-hop');
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Apartment' }).click();
  await expect(trash).toHaveCSS('animation-name', 'attention-hop');
  await trash.click();
  await page.getByRole('button', { name: 'I’ll take this' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(trash).not.toHaveClass(/needs-attention/);
  await page.getByRole('button', { name: 'Open Bathroom', exact: true }).click({ position: { x: 25, y: 25 } });
  const supply = page.locator('.supply-map-pin.needs-stock').first();
  await expect(supply).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(supply).toHaveCSS('animation-name', 'none');
});
