export const cameraPose = page => page.locator('.map-camera').evaluate(el => {
  const matrix = new DOMMatrix(getComputedStyle(el).transform);
  return { x: matrix.e, y: matrix.f, zoom: matrix.a };
});

export async function resetCanvas(page) {
  await page.locator('.map-viewport').focus();
  await page.keyboard.press('Home');
}

export async function zoomCanvas(page, target) {
  const { zoom } = await cameraPose(page);
  const anchor = await page.locator('.map-camera').evaluate(el => {
    const box = el.parentElement.getBoundingClientRect();
    return { clientX: box.x + el.offsetLeft + el.offsetWidth / 2, clientY: box.y + el.offsetTop + el.offsetHeight / 2 };
  });
  await page.locator('.map-viewport').dispatchEvent('wheel', { ctrlKey: true, deltaY: -Math.log(target / zoom) / .007, ...anchor });
  await page.waitForFunction(value => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.map-camera')).transform).a - value) < .00001, Math.max(.25, Math.min(3, target)));
}
