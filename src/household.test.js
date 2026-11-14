import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from './model.js';
import { profileFields, removeRoommate, updateOwnProfile, createHousehold, householdList } from './household.js';

test('an existing apartment cannot create a second one', () => {
  const original = initialState();
  assert.equal(createHousehold(original, 'Second home', 'second'), original);
  assert.equal(householdList(original).length, 1);
  assert.deepEqual(original.rooms, initialState().rooms);
});

test('a new account can set up its first apartment only', () => {
  const initial = initialState();
  const empty = { ...initial, cloud: true, householdId: null, households: [], apartment: '', people: [initial.people[0]], rooms: [], objects: [], tasks: [], inventory: [] };
  assert.deepEqual(householdList(empty), []);
  const created = createHousehold(empty, ' My nest ', 'first');
  assert.equal(created.apartment, 'My nest');
  assert.equal(created.householdId, 'first');
  assert.equal(created.currentUser, empty.currentUser);
  assert.deepEqual(created.tasks, []);
  assert.equal(created.people.length, 1);
  assert.equal(createHousehold(created, 'Another', 'second'), created);
});

test('legacy archived apartments stay preserved without being selectable', () => {
  const current = initialState();
  const archived = { id: 'old', apartment: 'Old home', people: current.people, rooms: [{ id: 'old-room' }] };
  const legacy = { ...current, households: [archived] };
  const visible = householdList(legacy);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].apartment, current.apartment);
  assert.equal(legacy.households[0], archived);
  assert.equal(createHousehold(legacy, 'Second home', 'second'), legacy);
});

test('profile updates reject other household members and missing identities', () => {
  const state = initialState();
  const fields = { name: 'Changed', color: '#dbe8ee', character: 'sky' };
  assert.equal(updateOwnProfile(state, 'maya', fields), state);
  assert.equal(updateOwnProfile(state, 'missing', fields), state);
  assert.equal(updateOwnProfile(state, undefined, fields), state);
  assert.equal(updateOwnProfile(state, state.currentUser, null), state);
});

test('self profile updates preserve identity, availability, and everyone else', () => {
  const state = initialState();
  const me = state.people.find(person => person.id === state.currentUser);
  const next = updateOwnProfile(state, me.id, {
    name: '  Helen  ', color: '#dbe8ee', character: 'sky',
    id: 'maya', currentUser: 'maya', status: 'Away', expires: 1, routine: [{ id: 'untrusted' }],
  });
  assert.equal(next.currentUser, state.currentUser);
  assert.deepEqual(next.people[0], { ...me, name: 'Helen', initial: 'H', color: '#dbe8ee', character: 'sky' });
  assert.equal(next.people[1], state.people[1]);
  assert.equal(next.people[2], state.people[2]);
  assert.equal(me.name, 'Jessalyn');
});

test('profile fields trim names and derive avatar initials', () => {
  assert.deepEqual(profileFields('  Helen  ', '#eddcc8'), { name: 'Helen', color: '#eddcc8', initial: 'H' });
  assert.equal(profileFields('éloise', '#eddcc8').initial, 'É');
});

test('removing a roommate reopens unfinished tasks and releases buying claims without removing history', () => {
  const state = initialState();
  state.tasks = [
    { id: 'pending', status: 'pending', from: 'jess', to: 'maya' },
    { id: 'assigned', status: 'assigned', from: 'alex', to: 'maya' },
    { id: 'sent', status: 'pending', from: 'maya', to: 'alex' },
    { id: 'other', status: 'assigned', from: 'maya', to: 'alex' },
    { id: 'done', status: 'done', from: 'jess', to: 'maya' },
  ];
  state.inventory[0].buyerId = 'maya';
  const next = removeRoommate(state, 'maya');
  assert.equal(next.people.some(p => p.id === 'maya'), false);
  for (const task of next.tasks.slice(0, 3)) { assert.equal(task.status, 'open'); assert.equal(task.to, null); }
  assert.equal(next.tasks[3].status, 'assigned');
  assert.equal(next.tasks[4].status, 'done');
  assert.equal(next.formerPeople[0].name, 'Maya');
  assert.equal(next.inventory[0].buyerId, null);
  assert.equal(state.inventory[0].buyerId, 'maya');
  assert.equal(state.people.length, 3);
});

test('the active profile cannot be removed and missing members are a no-op', () => {
  const state = initialState();
  assert.equal(removeRoommate(state, state.currentUser), state);
  assert.equal(removeRoommate(state, 'missing'), state);
});
