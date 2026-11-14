import { test, expect } from './fixtures';

for (const width of [390, 1280]) {
  test(`Profile headers stay fixed while only their content slides at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const result = animate.apply(this, args);
        if (this.classList.contains('profile-section-panel')) result.pause();
        return result;
      };
    });
    await page.goto('/');
    await page.getByRole('navigation', { name: width > 640 ? 'Main navigation' : 'Mobile navigation', exact: true }).getByRole('button', { name: 'Profile', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    const header = page.getByRole('button', { name: 'Your profile', exact: true });
    const panel = page.locator('#your-profile-content');
    const before = await header.boundingBox(), full = await panel.boundingBox();
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    const pressed = await header.boundingBox();
    expect(pressed.width).toBeCloseTo(before.width, 1);
    expect(pressed.height).toBeCloseTo(before.height, 1);
    await page.mouse.up();
    await panel.evaluate(el => { el.getAnimations()[0].currentTime = 100; });
    const middle = await panel.boundingBox(), during = await header.boundingBox();
    expect(middle.height).toBeGreaterThan(0);
    expect(middle.height).toBeLessThan(full.height);
    for (const key of ['width', 'height']) expect(during[key]).toBeCloseTo(before[key], 1);
    await panel.evaluate(el => el.getAnimations()[0].finish());
    await expect(panel).toBeHidden();
    await header.click();
    await panel.evaluate(el => { el.getAnimations()[0].currentTime = 100; });
    const opening = await panel.boundingBox();
    expect(opening.height).toBeGreaterThan(0);
    expect(opening.height).toBeLessThan(full.height);
    await panel.evaluate(el => el.getAnimations()[0].finish());
    expect((await panel.boundingBox()).height).toBeCloseTo(full.height, 1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await header.click();
    await expect(panel).toBeHidden();
    expect(await panel.evaluate(el => el.getAnimations().length)).toBe(0);
  });
}
