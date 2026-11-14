import { test, expect } from './fixtures';
const tab = (page, name) => page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name, exact: true });

test('one apartment is shown with no creation or switching controls, while invites and editing remain', async ({ page }) => {
  await page.goto('/');
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  await tab(page, 'Profile').click();
  await expect(page.getByRole('heading', { name: 'Your apartment', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New household', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Set up apartment', exact: true })).toHaveCount(0);
  await expect(page.locator('.household-switcher')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Invite members', exact: true })).toBeVisible();
  await page.getByRole('button', { name: original.apartment, exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Household name')).toHaveValue(original.apartment);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await expect(page.locator('.map-room')).toHaveCount(original.rooms.length);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  expect(after.rooms).toEqual(original.rooms);
  expect(after.tasks).toEqual(original.tasks);
  expect(after.inventory).toEqual(original.inventory);
});
