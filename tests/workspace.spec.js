import { test, expect, openAvailabilityDetails } from './fixtures';

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }, { width: 844, height: 390 }]) {
  test(`the apartment fills the home page and availability opens contextually at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const map = page.locator('.map-viewport');
    const dock = page.getByRole('complementary', { name: 'Roommate availability dock' });
    const mapBox = await map.boundingBox();
    expect(mapBox.width).toBe(viewport.width);
    expect(mapBox.y + mapBox.height).toBeCloseTo(viewport.height, 0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await expect(dock).toHaveClass(/collapsed/);
    await expect(page.getByRole('button', { name: 'Availability: Maya, Unknown', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'Expand availability' }).click();
    await expect(dock).toHaveClass(/expanded/);
    await dock.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const bounds = await dock.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(mapBox.y);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    if (viewport.width > 640) expect(bounds.x).toBeGreaterThan(viewport.width / 2);
    else expect(bounds.width).toBeGreaterThan(viewport.width * .9);
    await expect(dock.getByRole('group', { name: 'Maya, Unknown', exact: true }).locator('.tray-slot')).toBeVisible();
    await page.screenshot({ path: `test-results/workspace-availability-${viewport.width}.png` });
    await page.keyboard.press('Escape');
    await expect(dock).toHaveClass(/collapsed/);
    await openAvailabilityDetails(page, 'Availability: Jessalyn, Unknown');
    await expect(page.getByRole('dialog').getByRole('tab', { name: 'Right now' })).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(page.locator('.attention-section')).toHaveCount(0);
    const navigation = page.getByRole('navigation', { name: viewport.width > 640 ? 'Main navigation' : 'Mobile navigation', exact: true });
    await navigation.getByRole('button', { name: 'To-dos', exact: true }).click();
    await expect(page.getByRole('button', { name: /Take out the trash.*Anyone can pick this up/ })).toBeVisible();
    await expect(dock).toHaveCount(0);
  });
}
