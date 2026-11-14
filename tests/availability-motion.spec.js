import { test, expect } from './fixtures';

for (const width of [390, 1280]) {
  test(`availability slides and expands without scaling its contents at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const result = animate.apply(this, args);
        if (this.classList.contains('availability-dock')) result.pause();
        return result;
      };
    });
    await page.goto('/');
    const dock = page.getByRole('complementary', { name: 'Roommate availability dock' });
    const collapsed = await dock.boundingBox();
    await dock.getByRole('button', { name: 'Availability: Maya, Unknown', exact: true }).click();
    const opening = await dock.evaluate(el => {
      const animation = el.getAnimations()[0];
      const frames = animation.effect.getKeyframes();
      animation.currentTime = 100;
      return frames;
    });
    expect(opening[0].width).not.toBe(opening.at(-1).width);
    expect(opening[0].height).not.toBe(opening.at(-1).height);
    expect(opening.every(frame => !frame.transform?.includes('scale'))).toBe(true);
    const middle = await dock.boundingBox();
    expect(middle.width).toBeGreaterThan(collapsed.width);
    expect(middle.height).toBeGreaterThan(collapsed.height);
    await dock.evaluate(el => el.getAnimations()[0].finish());
    const expanded = await dock.boundingBox();
    expect(middle.height).toBeLessThan(expanded.height);
    await dock.getByRole('button', { name: 'Collapse availability' }).click();
    await dock.evaluate(el => { el.getAnimations()[0].currentTime = 100; });
    const closing = await dock.boundingBox();
    expect(closing.height).toBeLessThan(expanded.height);
    expect(closing.height).toBeGreaterThan(collapsed.height);
    await dock.evaluate(el => el.getAnimations()[0].finish());
    const restored = await dock.boundingBox();
    for (const key of ['x', 'y', 'width', 'height']) expect(restored[key]).toBeCloseTo(collapsed[key], 1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await dock.getByRole('button', { name: 'Expand availability' }).click();
    expect(await dock.evaluate(el => el.getAnimations().length)).toBe(0);
  });
}
