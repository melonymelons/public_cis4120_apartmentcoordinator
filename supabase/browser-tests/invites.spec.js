import { test, expect } from '@playwright/test';

const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const user = { id: id(1), email: 'helen@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { name: 'Helen' }, created_at: '2026-01-01T00:00:00Z' };
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test-signature`;
const session = { access_token: jwt, refresh_token: 'test-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user };
const token = 'a'.repeat(64);
const data = { rooms: [], objects: [], tasks: [], inventory: [], canvas: { cols: 12, rows: 14 } };
const profile = { id: user.id, name: 'Helen', initial: 'H', color: '#eddcc8', character: 'peach' };
const nav = page => page.getByRole('navigation', { name: 'Mobile navigation' });

async function mockAPI(page, signedIn = true, skipLoading = true) {
  await page.addLocatorHandler(page.getByRole('button', { name: 'Continue to sign in', exact: true }), async button => { await button.click(); });
  const state = {
    households: [{ id: id(10), name: 'Sunny apartment', data: structuredClone(data), revision: 0 }],
    members: [{ household_id: id(10), user_id: user.id, status: null, expires: null, routine: [] }],
    profiles: [structuredClone(profile)], calls: [],
  };
  await page.addInitScript(({ signedIn, session, skipLoading }) => {
    window.__ROOMIE_SKIP_MAP_INTRO__ = true;
    window.__NEST_SKIP_LOADING__ = skipLoading;
    if (signedIn && !localStorage.getItem('sb-127-auth-token')) localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
  }, { signedIn, session, skipLoading });
  await page.route('http://127.0.0.1:54321/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const path = url.pathname, body = request.postDataJSON();
    state.calls.push({ path, body, method: request.method(), authorization: request.headers().authorization, url: url.href });
    const respond = value => route.fulfill({ status: 200, json: value, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    if (request.method() === 'OPTIONS') return respond({});
    if (path === '/auth/v1/user') return respond(user);
    if (path === '/auth/v1/otp') return respond({});
    if (path === '/rest/v1/profiles') {
      if (request.method() === 'POST') {
        const value = { ...body, initial: body.name[0].toUpperCase(), character: null };
        if (!state.profiles.some(item => item.id === value.id)) state.profiles.push(value);
        return respond(request.headers().accept?.includes('object') ? value : [value]);
      }
      if (request.method() === 'PATCH') { Object.assign(state.profiles[0], body); return respond(null); }
      return respond(url.searchParams.has('id') ? state.profiles.filter(item => `eq.${item.id}` === url.searchParams.get('id')) : state.profiles);
    }
    if (path === '/rest/v1/households') return respond(state.households.filter(household => state.members.some(member => member.household_id === household.id && member.user_id === user.id)));
    if (path === '/rest/v1/household_members') return respond(state.members);
    if (path.endsWith('/rpc/create_household')) {
      const household = { id: id(11), name: body.p_name, data: structuredClone(data), revision: 0 };
      state.households.push(household); state.members.push({ household_id: household.id, user_id: user.id, status: null, expires: null, routine: [] });
      return respond(household.id);
    }
    if (path.endsWith('/rpc/create_household_invite')) return respond({ id: id(50), token, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
    if (path.endsWith('/rpc/revoke_household_invite')) return respond(null);
    if (path.endsWith('/rpc/preview_household_invite')) return respond({ name: 'Sunny apartment', expiresAt: new Date(Date.now() + 86400000).toISOString() });
    if (path.endsWith('/rpc/accept_household_invite')) {
      if (!state.members.some(member => member.household_id === id(10) && member.user_id === user.id)) state.members.push({ household_id: id(10), user_id: user.id, status: null, expires: null, routine: [] });
      return respond(id(10));
    }
    if (path.endsWith('/rpc/save_household')) {
      if (state.failSave) return route.fulfill({ status: 409, json: { message: 'HOUSEHOLD_CONFLICT: changed on another device' }, headers: { 'access-control-allow-origin': '*' } });
      const household = state.households.find(item => item.id === body.p_household);
      household.data = body.p_data; household.name = body.p_name; household.revision++;
      return respond(household.revision);
    }
    return route.fulfill({ status: 500, json: { message: `Unhandled test request: ${path}` } });
  });
  return state;
}

test('the welcome page is left-aligned, has its flower above the title, and never shows the map loader', async ({ page }) => {
  await mockAPI(page, false, false);
  await page.addInitScript(() => {
    window.__SAW_MAP_LOADER__ = false;
    new MutationObserver(() => { if (document.querySelector('.nest-loading')) window.__SAW_MAP_LOADER__ = true; }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');
  const title = page.getByRole('heading', { name: 'Welcome to nest.', exact: true });
  await expect(title).toBeVisible({ timeout: 2500 });
  await expect(page.getByRole('progressbar', { name: 'Loading nest' })).toHaveCount(0);
  expect(await page.evaluate(() => window.__SAW_MAP_LOADER__)).toBe(false);
  await expect(page.getByText('A little space for your shared home.', { exact: true })).toHaveCount(0);
  const flower = await page.locator('.welcome-flower').boundingBox(), heading = await title.boundingBox();
  expect(flower.y + flower.height).toBeLessThan(heading.y);
  await expect(title).toHaveCSS('text-align', 'left');
  expect(await page.locator('.welcome-flower').evaluate(el => el.offsetLeft)).toBe(await title.evaluate(el => el.offsetLeft));
  await page.screenshot({ path: 'test-results/welcome-page.png' });
});

test('the pink loading bar stays on green while household data loads', async ({ page }) => {
  await mockAPI(page, true, false);
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route(/\/rest\/v1\/households(?:\?|$)/, async route => { await ready; await route.fallback(); });
  await page.goto('/');
  await expect(page.getByRole('progressbar', { name: 'Loading nest' })).toBeVisible();
  release();
  await expect.poll(() => page.locator('.nest-loading').evaluateAll(nodes => nodes[0]?.dataset.complete), { timeout: 8000, intervals: [20] }).toBe('true');
  await expect(page.getByRole('button', { name: 'Edit apartment' })).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('progressbar', { name: 'Loading nest' })).toHaveCount(0);
});

test('email confirmation appears without moving the welcome title or form', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockAPI(page, false, false);
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const intro = page.locator('.welcome-intro');
  const email = page.getByLabel('Email', { exact: true });
  const button = page.getByRole('button', { name: 'Email me a sign-in link' });
  await email.fill(user.email);
  const before = await Promise.all([intro.boundingBox(), email.boundingBox(), button.boundingBox()]);
  await button.click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  const after = await Promise.all([intro.boundingBox(), email.boundingBox(), button.boundingBox()]);
  for (let i = 0; i < before.length; i++) for (const key of ['x', 'y', 'width', 'height']) expect(after[i][key]).toBeCloseTo(before[i][key], 1);
});

test('inline profile saving, invite sharing, and revocation for the one apartment', async ({ page }) => {
  const state = await mockAPI(page);
  await page.goto('/');
  await nav(page).getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Helen');
  await page.getByRole('button', { name: 'Yellow sweater', exact: true }).click();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect.poll(() => state.profiles[0].character).toBe('sunny');
  await expect(page.getByRole('button', { name: 'New household', exact: true })).toHaveCount(0);
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Invite members', exact: true }).click();
  await dialog.getByRole('button', { name: 'Create invite link', exact: true }).click();
  await expect(dialog.getByLabel('Join link', { exact: true })).toHaveValue(`http://127.0.0.1:5174/?invite=${token}`);
  await expect(dialog.getByRole('link', { name: 'Email link' })).toHaveAttribute('href', /mailto:.*invite/);
  await dialog.screenshot({ path: 'test-results/household-invite.png', animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Revoke link', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Create invite link', exact: true })).toBeVisible();
  expect(state.calls.some(call => call.path.endsWith('/rpc/revoke_household_invite'))).toBe(true);
  expect(state.calls.filter(call => call.path.includes('/rest/')).every(call => call.authorization === `Bearer ${jwt}`)).toBe(true);
});

test('an invite requires sign-in and confirmation, preserving the token through the email redirect', async ({ page }) => {
  const state = await mockAPI(page, false);
  state.members = [];
  await page.goto(`/?invite=${token}`);
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  const otp = state.calls.find(call => call.path === '/auth/v1/otp');
  expect(new URL(otp.url).searchParams.get('redirect_to')).toContain(`invite=${token}`);
  expect(state.calls.some(call => call.path.endsWith('/rpc/accept_household_invite'))).toBe(false);
  await page.evaluate(session => localStorage.setItem('sb-127-auth-token', JSON.stringify(session)), session);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Join Sunny apartment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Join household', exact: true }).click();
  await expect(nav(page)).toBeVisible();
  expect(new URL(page.url()).searchParams.has('invite')).toBe(false);
  const redemption = state.calls.find(call => call.path.endsWith('/rpc/accept_household_invite'));
  expect(redemption.body).toEqual({ p_token: token });
  expect(redemption.authorization).toBe(`Bearer ${jwt}`);
});

test('shared household edits use the server revision instead of writing profiles inside household data', async ({ page }) => {
  const state = await mockAPI(page);
  await page.goto('/');
  await nav(page).getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sunny apartment', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Household name').fill('Renamed nest');
  await page.getByRole('button', { name: 'Save household', exact: true }).click();
  await expect.poll(() => state.households[0].name).toBe('Renamed nest');
  const save = state.calls.find(call => call.path.endsWith('/rpc/save_household'));
  expect(save.body.p_revision).toBe(0);
  expect(save.body.p_data.people).toBeUndefined();
  await nav(page).getByRole('button', { name: 'Apartment', exact: true }).click();
  await page.getByRole('button', { name: 'Edit apartment', exact: true }).click();
  await page.getByRole('button', { name: 'Add room', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add Kitchen', exact: true }).click();
  expect(state.households[0].data.rooms.length).toBe(0);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect.poll(() => state.households[0].data.rooms.length).toBe(1);
  expect(state.households[0].data.rooms[0].type).toBe('kitchen');
});

test('a new account gets its own profile and creates its first household without demo identities', async ({ page }) => {
  const state = await mockAPI(page);
  state.profiles = []; state.households = []; state.members = [];
  await page.goto('/');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Helen');
  await expect(nav(page).getByRole('button', { name: 'Apartment', exact: true })).toBeDisabled();
  await expect(page.getByText('Jessalyn', { exact: true })).toHaveCount(0);
  expect(state.profiles[0].id).toBe(user.id);
  await page.getByRole('button', { name: 'Set up apartment', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Apartment name').fill('First nest');
  await page.getByRole('button', { name: 'Create apartment', exact: true }).click();
  await expect(nav(page).getByRole('button', { name: 'Apartment', exact: true })).toBeEnabled();
  await expect(page.getByRole('article', { name: 'Helen household profile', exact: true })).toBeVisible();
});

test('a stale save reports the conflict and leaves the server household untouched', async ({ page }) => {
  const state = await mockAPI(page);
  state.failSave = true;
  await page.goto('/');
  await nav(page).getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sunny apartment', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Household name').fill('Conflicting name');
  await page.getByRole('button', { name: 'Save household', exact: true }).click();
  await expect(page.locator('.cloud-sync-error')).toContainText('changed on another device');
  await expect(page.locator('.cloud-sync-error').getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
  expect(state.households[0].name).toBe('Sunny apartment');
});

 test('an account with an apartment cannot join another through a link', async ({ page }) => {
  const state = await mockAPI(page);
  await page.goto(`/?invite=${token}`);
  await expect(page.getByText('You already belong to Sunny apartment. You can only have one apartment at a time.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join household', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open your apartment', exact: true }).click();
  await expect(nav(page)).toBeVisible();
  expect(state.calls.some(call => call.path.endsWith('/rpc/accept_household_invite'))).toBe(false);
});

for (const width of [320, 390, 1280]) test(`invite panel fits its content and supports copy and revoke at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const state = await mockAPI(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: width > 640 ? 'Main navigation' : 'Mobile navigation', exact: true }).getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Invite members', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); });
  expect((await dialog.boundingBox()).height).toBeLessThan(350);
  await dialog.getByRole('button', { name: 'Create invite link', exact: true }).click();
  await expect(dialog.getByLabel('Join link', { exact: true })).toHaveValue(`http://127.0.0.1:5174/?invite=${token}`);
  expect((await dialog.boundingBox()).height).toBeLessThan(450);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.screenshot({ path: `test-results/invite-panel-${width}.png`, animations: 'disabled' });
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__testCopiedInvite = text; } } }));
  const copy = await dialog.getByRole('button', { name: 'Copy link', exact: true }).boundingBox();
  await dialog.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__testCopiedInvite)).toBe(`http://127.0.0.1:5174/?invite=${token}`);
  expect((await dialog.getByRole('button', { name: 'Copied', exact: true }).boundingBox()).width).toBeCloseTo(copy.width, 0);
  await expect(dialog.getByRole('link', { name: 'Email link' })).toHaveAttribute('href', /mailto:.*invite/);
  await dialog.getByRole('button', { name: 'Revoke link', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Create invite link', exact: true })).toBeVisible();
  expect(state.calls.some(call => call.path.endsWith('/rpc/revoke_household_invite'))).toBe(true);
});

test('guest mode persists local edits, avoids cloud writes and returns to sign-in', async ({ page }) => {
  const api = await mockAPI(page, false);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Apartment canvas' })).toBeVisible();
  const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem('nest-guest-v1')));
  expect(fresh.people.map(p => p.name)).toEqual(['Guest', 'Roomate 1', 'Roomate 2']);
  for (const key of ['rooms', 'objects', 'tasks', 'inventory']) expect(fresh[key]).toEqual([]);
  await page.getByRole('button', { name: 'Edit apartment', exact: true }).click();
  await page.getByRole('button', { name: 'Add room', exact: true }).click();
  await page.getByRole('button', { name: 'Add Kitchen', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await nav(page).getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Invite members', exact: true }).click();
  const invite = page.getByRole('dialog');
  await expect(invite.getByText('Create a private link for a roommate to join with their own account.')).toBeVisible();
  await expect(invite.getByRole('alert')).toHaveCount(0);
  await invite.getByRole('button', { name: 'Create invite link', exact: true }).click();
  await expect(invite.getByRole('alert')).toHaveText('Invites aren’t available for guest accounts. Sign in to invite roommates.');
  await expect(invite.getByLabel('Join link', { exact: true })).toHaveCount(0);
  await invite.getByRole('button', { name: 'Close dialog', exact: true }).click();
  const profile = page.getByRole('form', { name: 'Your profile', exact: true });
  await profile.getByLabel('Name', { exact: true }).fill('Guest tester');
  await profile.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('nest-guest-v1')).people.find(p => p.id === 'jess').name)).toBe('Guest tester');
  expect(await page.evaluate(() => localStorage.getItem('roomie-v1'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Apartment canvas' })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Profile', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nest-guest-v1')).rooms.map(r => r.type))).toEqual(['kitchen']);
  await expect(profile.getByLabel('Name', { exact: true })).toHaveValue('Guest tester');
  await page.getByRole('button', { name: 'Exit guest mode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue as guest', exact: true })).toBeVisible();
  expect(api.calls.filter(call => call.path.startsWith('/rest/') || call.path === '/auth/v1/otp')).toEqual([]);
});

for (const [status, code, expected] of [[429, 'over_email_send_rate_limit', 'Supabase’s email service has reached its sending limit.'], [400, 'email_address_not_authorized', 'Supabase’s test email service can only send to approved team addresses.']]) test(`email error ${code} explains the provider restriction below the email button`, async ({ page }) => {
  await mockAPI(page, false);
  await page.route('**/auth/v1/otp?**', route => route.fulfill({ status, json: { code, msg: 'Email unavailable' }, headers: { 'access-control-allow-origin': '*', 'x-supabase-api-version': '2024-01-01', 'access-control-expose-headers': 'x-supabase-api-version' } }));
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  const emailButton = page.getByRole('button', { name: 'Email me a sign-in link' });
  await emailButton.click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText(expected);
  const button = await emailButton.boundingBox(), error = await alert.boundingBox(), guest = await page.getByRole('button', { name: 'Continue as guest' }).boundingBox();
  expect(error.y).toBeGreaterThan(button.y + button.height);
  expect(error.y + error.height).toBeLessThan(guest.y);
});
