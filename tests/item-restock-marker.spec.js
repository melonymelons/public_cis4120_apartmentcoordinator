import { test, expect } from './fixtures';

async function itemAppearance(item) {
  return item.evaluate(el => {
    const css = getComputedStyle(el);
    return { color: css.color, fill: css.backgroundColor, radius: css.borderRadius, label: el.getAttribute('aria-label'), text: el.textContent };
  });
}

test('fixed inventory marker stays unchanged when its separate restock task is assigned', async ({ page }) => {
  await page.goto('/');
  const mapItem = page.locator('.map-page [data-item="stock-paper"]');
  const before = await itemAppearance(mapItem);
  await expect(mapItem).toHaveClass(/inventory-marker/);
  await expect(mapItem).toHaveCSS('animation-name', 'none');
  await expect(mapItem.locator('.inventory-stock-note')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Bathroom', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Restock task', exact: true })).toHaveCount(0);
  await dialog.locator('[data-item="stock-paper"]').click();
  await dialog.getByRole('button', { name: 'Restock task', exact: true }).click();
  await dialog.getByRole('button', { name: 'I’ll take this', exact: true }).click();
  await expect(dialog.getByText('Assigned to you', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  const item = dialog.locator('[data-item="stock-paper"]');
  const task = dialog.locator('[data-object="supplies1"]');
  await expect(item).not.toHaveClass(/restock-assigned|floating-marker/);
  await expect(item).toHaveCSS('animation-name', 'none');
  await expect(item.locator('.responsibility-character')).toHaveCount(0);
  await expect(task).toHaveClass(/assigned/);
  await expect(task).not.toHaveClass(/needs-attention/);
  await expect(task).toHaveCSS('background-color', 'rgb(205, 221, 175)');
  await expect(item).not.toHaveAttribute('aria-label', /in charge/);
  expect(await item.evaluate(el => getComputedStyle(el, '::before').clipPath)).toBe('none');
  await dialog.evaluate(async el => { await Promise.allSettled(el.getAnimations().map(a => a.finished)); });
  await page.screenshot({ path: 'test-results/fixed-item-with-assigned-restock.png' });
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  expect(await itemAppearance(mapItem)).toEqual(before);
  await page.reload();
  expect(await itemAppearance(mapItem)).toEqual(before);
  await expect(page.locator('.map-page [data-object="supplies1"]')).not.toHaveClass(/needs-attention/);
});
