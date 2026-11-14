import { initialState } from '../src/model.js';

export async function enterEdit(page) {
  const edit = page.getByRole('button', { name: 'Edit apartment', exact: true });
  if (await edit.isVisible()) await edit.click();
}

export async function addRoom(page, type) {
  await enterEdit(page);
  await page.getByRole('button', { name: 'Add room', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: `Add ${type}`, exact: true }).click();
}

export async function seedEmptyApartment(page) {
  const state = { ...initialState(), rooms: [], objects: [], tasks: [], inventory: [] };
  await page.addInitScript(value => { if (!localStorage.getItem('roomie-v1')) localStorage.setItem('roomie-v1', JSON.stringify(value)); }, state);
}

export async function dragRoom(page, id, dx, dy, touch = false) {
  const map = page.locator('.map-camera > .map-canvas');
  const box = await map.boundingBox();
  const cols = Number(await map.getAttribute('data-cols')), rows = Number(await map.getAttribute('data-rows'));
  const room = await map.locator(`[data-room="${id}"]`).boundingBox();
  const start = { x: room.x + room.width / 2, y: room.y + room.height / 2 };
  if (touch) {
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    for (let i = 1; i <= 8; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + dx * box.width / cols * i / 8, y: start.y + dy * box.height / rows * i / 8, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + dx * box.width / cols, start.y + dy * box.height / rows, { steps: 8 }); await page.mouse.up();
  }
}
