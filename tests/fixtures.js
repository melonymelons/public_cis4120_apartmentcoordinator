import { test as base, expect } from '@playwright/test';
import { initialState } from '../src/model.js';

// Existing interaction tests use stable map coordinates. The introductory camera
// animation is exercised separately in map-zoom.spec.js with the base fixture.
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(sample => { window.__ROOMIE_SKIP_MAP_INTRO__ = true; window.__NEST_SKIP_LOADING__ = true; if (!localStorage.getItem('roomie-v1')) localStorage.setItem('roomie-v1', JSON.stringify(sample)); }, initialState());
    await use(context);
  },
});
export { expect };

export async function openAvailabilityDetails(page, name) {
  const expand = page.getByRole('button', { name: 'Expand availability', exact: true });
  if (await expand.isVisible()) await expand.click();
  await page.getByRole('button', { name, exact: true }).click();
}

// Test setup only: represent a different local actor without exposing an
// account-switching action in the application. This does not simulate real auth.
export async function setFixtureUser(page, id) {
  await page.evaluate(id => {
    const state = JSON.parse(localStorage.getItem('roomie-v1'));
    if (!state.people.some(person => person.id === id)) throw new Error('Missing fixture user');
    localStorage.setItem('roomie-v1', JSON.stringify({ ...state, currentUser: id }));
  }, id);
  await page.reload();
}
