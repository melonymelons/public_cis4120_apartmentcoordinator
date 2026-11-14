import { test, expect } from './fixtures';

for (const width of [320, 390, 1280]) {
  test(`profile choices, save feedback, and household actions fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('navigation', { name: width > 640 ? 'Main navigation' : 'Mobile navigation', exact: true }).getByRole('button', { name: 'Profile', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    const form = page.getByRole('form', { name: 'Your profile', exact: true });
    await expect(form.getByRole('button', { name: 'Save profile' })).toBeDisabled();
    await form.getByRole('button', { name: 'Pink hoodie', exact: true }).click();
    await expect(form.getByRole('button', { name: 'Save profile' })).toBeEnabled();
    const choice = form.getByRole('button', { name: 'Pink hoodie', exact: true });
    const tile = await choice.boundingBox(), check = await choice.locator('.character-selected').boundingBox();
    expect(check.x).toBeGreaterThanOrEqual(tile.x);
    expect(check.y).toBeGreaterThanOrEqual(tile.y);
    expect(check.x + check.width).toBeLessThanOrEqual(tile.x + tile.width);
    expect(check.y + check.height).toBeLessThanOrEqual(tile.y + tile.height);
    await form.getByRole('button', { name: 'Rose', exact: true }).click();
    await expect(form.locator('.avatar-colors button.selected svg')).toHaveCount(0);
    await form.getByRole('button', { name: 'Save profile' }).click();
    await expect(form.getByRole('status')).toHaveCount(0);
    await expect(form.getByRole('button', { name: 'Save profile' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Invite members', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'The little apartment', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/profile-layout-${width}.png`, fullPage: true });
    await page.getByRole('article', { name: 'Jessalyn household profile', exact: true }).locator('.household-member-detail').click();
    await expect(form.getByLabel('Name', { exact: true })).toBeFocused();
  });
}

test('profile sections collapse independently and retain unsaved edits', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
  const profileToggle = page.getByRole('button', { name: 'Your profile', exact: true });
  const apartmentToggle = page.getByRole('button', { name: 'Your apartment', exact: true });
  const name = page.getByLabel('Name', { exact: true });
  await name.fill('Helen');
  await profileToggle.click();
  await expect(profileToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.inline-profile-form')).toBeHidden();
  await expect(page.locator('.inline-profile-form')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Invite members', exact: true })).toBeVisible();
  await apartmentToggle.click();
  await expect(page.getByRole('button', { name: 'Invite members', exact: true })).toBeHidden();
  await apartmentToggle.click();
  await page.getByRole('article', { name: 'Jessalyn household profile', exact: true }).locator('.household-member-detail').click();
  await expect(profileToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(name).toHaveValue('Helen');
  await expect(name).toBeFocused();
});
