import { test, expect } from './fixtures';
import { initialState } from '../src/model.js';

const profileTab = page => page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Profile', exact: true });

test('other roommates are read-only and account switching is unavailable', async ({ page }) => {
  await page.goto('/');
  await profileTab(page).click();
  await page.screenshot({ path: 'test-results/profile-page.png', fullPage: true });
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
  await expect(page.locator('.inline-profile-form .character-picker')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit profile', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Maya', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Alex', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Switch demo roommate', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add roommate', exact: true })).toHaveCount(0);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  await page.getByRole('article', { name: 'Maya household profile' }).locator('.household-member-detail').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Maya’s availability', exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveCount(0);
  await expect(dialog.locator('.character-picker')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /Edit|Remove/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')));
  expect(after.currentUser).toBe(before.currentUser);
  expect(after.people).toEqual(before.people);
});

test('edit your profile and household name without losing your availability', async ({ page }) => {
  const seed = initialState();
  seed.people[0].status = 'Studying';
  seed.people[0].expires = Date.now() + 3600000;
  await page.addInitScript(state => localStorage.setItem('roomie-v1', JSON.stringify(state)), seed);
  await page.goto('/');
  await profileTab(page).click();
  const profile = page.getByRole('form', { name: 'Your profile', exact: true });
  const dialog = page.getByRole('dialog');
  await expect(page.getByRole('button', { name: 'Remove from household' })).toHaveCount(0);
  await profile.getByLabel('Name', { exact: true }).fill('Helen');
  await profile.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.locator('.profile-summary').getByLabel('Name', { exact: true })).toHaveValue('Helen');
  await expect(page.locator('.profile-summary').getByText('Studying')).toHaveCount(0);
  await page.getByRole('button', { name: 'The little apartment', exact: true }).click();
  await dialog.getByLabel('Household name').fill('Our sunny apartment');
  await dialog.getByRole('button', { name: 'Save household' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Apartment', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).apartment)).toBe('Our sunny apartment');
  await expect(page.getByRole('group', { name: 'Helen, Studying', exact: true })).toBeVisible();
});

test('saving your character cannot change another roommate’s profile', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).people);
  await profileTab(page).click();
  const profile = page.getByRole('form', { name: 'Your profile', exact: true });
  const dialog = page.getByRole('dialog');
  await profile.getByLabel('Name', { exact: true }).fill('Helen');
  await profile.getByRole('button', { name: 'Lilac cardigan', exact: true }).click();
  await profile.getByRole('button', { name: 'Save profile' }).click();
  await page.reload();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('roomie-v1')).people);
  expect(after[0]).toMatchObject({ id: 'jess', name: 'Helen', character: 'lilac' });
  expect(after.slice(1)).toEqual(before.slice(1));
});
