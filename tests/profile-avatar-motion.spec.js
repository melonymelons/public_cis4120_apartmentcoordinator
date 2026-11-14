import { test, expect } from './fixtures';

test('avatar background controls reveal without a floating save row covering them', async ({ page }) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.classList.contains('profile-section-panel')) animation.pause();
      return animation;
    };
  });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  const toggle = page.getByRole('button', { name: 'Your profile', exact: true });
  const panel = page.locator('#your-profile-content');
  await toggle.click();
  await panel.evaluate(el => el.getAnimations()[0].finish());
  await expect(panel).toBeHidden();
  await toggle.click();
  for (const time of [80, 160, 240]) {
    await panel.evaluate((el, time) => { el.getAnimations()[0].currentTime = time; }, time);
    await page.screenshot({ path: `test-results/avatar-expand-${time}.png` });
    const positions = await panel.evaluate(el => {
      const colors = el.querySelector('.avatar-colors').getBoundingClientRect();
      const save = el.querySelector('.profile-save-row').getBoundingClientRect();
      return { colorsBottom: colors.bottom, saveTop: save.top };
    });
    expect(positions.saveTop).toBeGreaterThanOrEqual(positions.colorsBottom);
  }
  await panel.evaluate(el => el.getAnimations()[0].finish());
});
