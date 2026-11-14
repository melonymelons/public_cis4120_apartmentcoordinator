import { test, expect } from './fixtures';

test('wide and tall rooms have continuous opaque surfaces and extra furnishings', async ({ page }) => {
  await page.setViewportSize({ width: 1320, height: 1000 });
  await page.goto('/');
  const scenes = await page.evaluate(async () => {
    const { drawRoomScene, roomArtBounds } = await import('/src/roomScene.js');
    const gallery = document.createElement('div');
    Object.assign(gallery.style, { position: 'fixed', inset: '0', zIndex: '999', background: '#e3e8d7', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', padding: '24px', overflow: 'auto' });
    document.body.append(gallery);
    const results = [];
    for (const shape of ['tall', 'wide']) for (const type of ['living', 'bedroom', 'kitchen', 'bathroom']) {
      const img = new Image(); img.src = `/pixel/${type}.webp`; await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = shape === 'tall' ? 260 : 300; canvas.height = shape === 'tall' ? 400 : 190;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const bounds = roomArtBounds(img, type);
      const scale = Math.min(canvas.width / bounds.width, canvas.height / bounds.height);
      ctx.scale(scale, scale);
      const furnishings = drawRoomScene(ctx, img, type, canvas.width / scale, canvas.height / scale);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) transparent++;
      const card = document.createElement('div'); card.textContent = `${type} · ${shape}`;
      canvas.style.cssText = 'display:block;border:3px solid #85603f;max-width:100%;margin-top:8px;image-rendering:pixelated'; card.append(canvas); gallery.append(card);
      results.push({ type, shape, transparent, furnishings });
    }
    return results;
  });
  await page.screenshot({ path: 'test-results/room-scene-extensions.png' });
  for (const scene of scenes) {
    expect(scene.transparent, `${scene.type} ${scene.shape} has no unfilled strips`).toBe(0);
    expect(scene.furnishings, `${scene.type} ${scene.shape} fills extra space`).toBeGreaterThan(0);
  }
});
