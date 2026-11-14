import { test, expect } from '@playwright/test';

test('welcome flower keeps rotating on mobile and respects reduced motion', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue to sign in', exact: true }).click();
  const flower = page.locator('.welcome-flower');
  await expect(flower).toBeVisible();
  await expect(flower).toHaveCSS('animation-name', 'welcome-flower-spin');
  const first = await flower.evaluate(el => getComputedStyle(el).transform);
  await expect.poll(() => flower.evaluate(el => getComputedStyle(el).transform)).not.toBe(first);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(flower).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(flower).toHaveCSS('animation-name', 'welcome-flower-spin');
});

test('guest loader makes progress and paints a full bar before revealing the mobile map', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue to sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
  const loader = page.locator('.nest-loading');
  const fill = page.locator('.nest-loading-fill');
  await expect(loader).toBeVisible();
  const initial = await fill.evaluate(el => getComputedStyle(el).clipPath);
  await expect.poll(() => fill.evaluate(el => getComputedStyle(el).clipPath)).not.toBe(initial);
  await expect(loader).toHaveAttribute('data-complete', 'true', { timeout: 8000 });
  await expect(fill).toHaveCSS('clip-path', 'inset(0px)');
  await expect(page.getByRole('button', { name: 'Edit apartment' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Apartment canvas' })).toBeVisible();
});

test('essential loading progress advances even with CSS animations disabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue to sign in', exact: true }).click();
  await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
  await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
  const bar = page.getByRole('progressbar', { name: 'Loading nest' });
  await expect(bar).toBeVisible();
  const first = Number(await bar.getAttribute('aria-valuenow'));
  await expect.poll(async () => Number(await bar.getAttribute('aria-valuenow'))).toBeGreaterThan(first);
  await expect(bar).toHaveAttribute('aria-valuenow', '100', { timeout: 8000 });
  await expect(page.locator('.nest-loading-fill')).toHaveCSS('clip-path', 'inset(0px)');
  await expect(page.getByRole('region', { name: 'Apartment canvas' })).toBeVisible();
});

test('motion intro explains iPhone settings, allows continuing, and preserves invitations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?invite=demo-invitation');
  await expect(page.getByRole('heading', { name: 'See nest. in motion' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'iPhone instructions' })).toContainText('Accessibility → Motion');
  await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to nest.' })).toBeVisible();
  await expect(page.locator('.welcome-flower')).toHaveCSS('animation-name', 'none');
  expect(new URL(page.url()).searchParams.get('invite')).toBe('demo-invitation');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'See nest. in motion' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to nest.' })).toBeVisible();
});

test('motion guidance stays visible with Reduce Motion off until Continue is tapped', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'See nest. in motion' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('heading', { name: 'See nest. in motion' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to nest.' })).toBeVisible();
  await expect(page.locator('.welcome-flower')).toHaveCSS('animation-name', 'welcome-flower-spin');
});

test('standalone Hello page opens directly without login or cloud requests', async ({ page }) => {
  const cloudRequests = [];
  await page.route('http://127.0.0.1:54321/**', async route => { cloudRequests.push(route.request().url()); await route.abort(); });
  await page.goto('/#hello');
  await expect(page.getByRole('heading', { name: 'Hello world', exact: true })).toBeVisible();
  await expect(page.locator('.hello-world-output')).toHaveText('Hello world');
  await expect(page.getByRole('heading', { name: 'Hello styles', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hello styles', exact: true })).toBeVisible();
  expect(cloudRequests).toEqual([]);
});
