import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const user = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const db = new PGlite();
await db.exec(`
  create schema auth;
  create role anon;
  create role authenticated;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  insert into auth.users values ('${user(1)}'), ('${user(2)}'), ('${user(3)}'), ('${user(4)}');
`);
for (const file of (await readdir(new URL('./migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(`./migrations/${file}`, import.meta.url), 'utf8'));
async function actor(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || '']);
  await db.exec(`set role ${id ? 'authenticated' : 'anon'}`);
}
async function scalar(sql, args = []) { return (await db.query(sql, args)).rows[0].value; }
for (let n = 1; n <= 4; n++) {
  await actor(user(n));
  await db.query('insert into public.profiles(id,name) values($1,$2)', [user(n), `Person ${n}`]);
}

let household, invitation;
test('create household atomically adds its creator and isolates nonmembers', async () => {
  await actor(user(1));
  household = await scalar("select public.create_household('Our nest') as value");
  assert.equal((await db.query('select * from public.household_members')).rows.length, 1);
  await actor(user(2));
  assert.equal((await db.query('select * from public.households')).rows.length, 0);
  await assert.rejects(db.query('select public.create_household_invite($1)', [household]), /Not a household member/);
  await assert.rejects(db.query('insert into public.household_members(household_id,user_id) values($1,$2)', [household, user(2)]), /permission denied/);
});

test('anonymous callers cannot create invites or redeem a household membership', async () => {
  await actor(null);
  await assert.rejects(db.query("select public.accept_household_invite('bad')"), /permission denied/);
  await assert.rejects(db.query("select public.create_household('bad')"), /permission denied/);
});

test('single-use invites join the authenticated person, are idempotent, and cannot be reused', async () => {
  await actor(user(1));
  invitation = await scalar('select public.create_household_invite($1) as value', [household]);
  assert.match(invitation.token, /^[0-9a-f]{64}$/);
  await assert.rejects(db.query('select * from public.household_invites'), /permission denied/);
  await actor(user(2));
  assert.equal((await scalar('select public.preview_household_invite($1) as value', [invitation.token])).name, 'Our nest');
  assert.equal(await scalar('select public.accept_household_invite($1) as value', [invitation.token]), household);
  assert.equal(await scalar('select public.accept_household_invite($1) as value', [invitation.token]), household);
  assert.equal((await db.query('select * from public.household_members')).rows.length, 2);
  await actor(user(3));
  await assert.rejects(db.query('select public.accept_household_invite($1)', [invitation.token]), /already been used/);
});

test('profiles and availability remain self-owned after joining', async () => {
  await actor(user(2));
  assert.equal((await db.query('select * from public.profiles')).rows.length, 2);
  await db.query("update public.profiles set name='Own name', character='peach' where id=$1", [user(2)]);
  await db.query("update public.profiles set name='Stolen name' where id=$1", [user(1)]);
  assert.equal((await db.query('select name from public.profiles where id=$1', [user(1)])).rows[0].name, 'Person 1');
  await db.query("update public.household_members set status='Away' where user_id=$1", [user(1)]);
  assert.equal((await db.query('select status from public.household_members where user_id=$1', [user(1)])).rows[0].status, null);
  await assert.rejects(db.query('update public.profiles set id=$1 where id=$2', [user(3), user(2)]), /permission denied/);
  await assert.rejects(db.query("insert into public.profiles(id,name) values($1,'Other account')", [user(5)]), /row-level security/);
});

test('revoked and expired invites cannot be redeemed', async () => {
  await actor(user(1));
  const revoked = await scalar('select public.create_household_invite($1) as value', [household]);
  await db.query('select public.revoke_household_invite($1)', [revoked.id]);
  await actor(user(3));
  await assert.rejects(db.query('select public.accept_household_invite($1)', [revoked.token]), /expired|no longer available/);
  await actor(user(1));
  const expired = await scalar('select public.create_household_invite($1) as value', [household]);
  await db.exec('reset role');
  await db.query("update public.household_invites set expires_at=now()-interval '1 second' where id=$1", [expired.id]);
  await actor(user(3));
  await assert.rejects(db.query('select public.accept_household_invite($1)', [expired.token]), /expired|no longer available/);
});

test('shared state uses revision checks and validates the actor of assignment transitions', async () => {
  const data = { rooms: [], objects: [], tasks: [{ id: 'task', status: 'open', from: user(1), to: null }], inventory: [], canvas: { cols: 12, rows: 14 } };
  await actor(user(1));
  assert.equal(await scalar('select public.save_household($1,0,$2,$3) as value', [household, 'Our nest', data]), 1);
  await assert.rejects(db.query('select public.save_household($1,0,$2,$3)', [household, 'Stale overwrite', data]), /HOUSEHOLD_CONFLICT/);
  await assert.rejects(db.query('select public.save_household($1,null,$2,$3)', [household, 'Missing revision', data]), /HOUSEHOLD_CONFLICT/);
  await actor(user(2));
  const invalid = structuredClone(data); invalid.tasks[0] = { ...invalid.tasks[0], status: 'assigned', to: user(1) };
  await assert.rejects(db.query('select public.save_household($1,1,$2,$3)', [household, 'Our nest', invalid]), /another member/);
  invalid.tasks[0] = { id: 'task', status: 'assigned', to: null, from: null };
  await assert.rejects(db.query('select public.save_household($1,1,$2,$3)', [household, 'Our nest', invalid]), /another member/);
  const valid = structuredClone(data); valid.tasks[0] = { ...valid.tasks[0], status: 'assigned', to: user(2) };
  assert.equal(await scalar('select public.save_household($1,1,$2,$3) as value', [household, 'Our nest', valid]), 2);
  await actor(user(1));
  valid.tasks[0].status = 'done';
  await assert.rejects(db.query('select public.save_household($1,2,$2,$3)', [household, 'Our nest', valid]), /another member/);
});

test('rapid create-and-complete changes remain valid without assigning another person', async () => {
  await actor(user(1));
  const row = (await db.query('select data, revision from public.households where id=$1', [household])).rows[0];
  const fast = structuredClone(row.data);
  fast.tasks.push({ id: 'fast', title: 'Quick task', status: 'done', from: user(1), to: user(1) });
  const revision = await scalar('select public.save_household($1,$2,$3,$4) as value', [household, row.revision, 'Our nest', fast]);
  fast.tasks.push({ id: 'forged', status: 'assigned', from: user(1), to: user(2) });
  await assert.rejects(db.query('select public.save_household($1,$2,$3,$4)', [household, revision, 'Our nest', fast]), /cannot assign work to others/);
});

test('purchase claims cannot be taken from another buyer, but restocking can clear them', async () => {
  await actor(user(1));
  const row = (await db.query('select data, revision from public.households where id=$1', [household])).rows[0];
  const stock = structuredClone(row.data);
  stock.inventory.push({ id: 'paper', status: 'low', buyerId: user(1) });
  const revision = await scalar('select public.save_household($1,$2,$3,$4) as value', [household, row.revision, 'Our nest', stock]);
  await actor(user(2));
  stock.inventory[0].buyerId = user(2);
  await assert.rejects(db.query('select public.save_household($1,$2,$3,$4)', [household, revision, 'Our nest', stock]), /only claim an unclaimed purchase/);
  stock.inventory[0].buyerId = null;
  await assert.rejects(db.query('select public.save_household($1,$2,$3,$4)', [household, revision, 'Our nest', stock]), /Only the buyer/);
  stock.inventory[0].status = 'in';
  assert.equal(await scalar('select public.save_household($1,$2,$3,$4) as value', [household, revision, 'Our nest', stock]), revision + 1);
});

test('an account cannot create or join a second apartment, and rejection does not consume an invite', async () => {
  await actor(user(1));
  await assert.rejects(db.query("select public.create_household('Second apartment')"), /already belong to an apartment/);
  const invitation = await scalar('select public.create_household_invite($1) as value', [household]);
  await actor(user(3));
  const other = await scalar("select public.create_household('Different apartment') as value");
  await assert.rejects(db.query('select public.accept_household_invite($1)', [invitation.token]), /already belong to an apartment/);
  assert.equal((await db.query('select household_id from public.household_members where user_id=$1', [user(3)])).rows[0].household_id, other);
  await actor(user(4));
  assert.equal(await scalar('select public.accept_household_invite($1) as value', [invitation.token]), household);
  await db.exec('reset role');
  await assert.rejects(db.query('insert into public.household_members(household_id,user_id) values($1,$2)', [other, user(4)]), /unique constraint/);
});

test.after(async () => { await db.close(); });
