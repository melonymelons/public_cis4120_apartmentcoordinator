import test from 'node:test';
import assert from 'node:assert/strict';
import { canPlace, findSpace, transitionTask, activeStatus, initialState, loadState, loadDemoState, objectName, objectTasks, primaryObjectTask, constrainCanvas } from './model.js';

test('unflagged tasks can be flagged explicitly, and flagged work takes priority on a shared marker', () => {
  const task = { id: 'new', objectId: 'plant', status: 'open', attention: false, from: 'jess', to: null };
  const flagged = transitionTask(task, 'flag', 'jess');
  assert.equal(task.attention, false);
  assert.equal(flagged.attention, true);
  assert.equal(transitionTask(flagged, 'flag', 'jess'), flagged);
  assert.equal(primaryObjectTask([task, { ...flagged, id: 'urgent' }], 'plant').id, 'urgent');
  const assigned = { ...task, status: 'assigned', to: 'maya' };
  assert.equal(transitionTask(assigned, 'flag', 'jess'), assigned);
});

test('canvas resizing snaps to cells and cannot crop existing rooms', () => {
  assert.deepEqual(constrainCanvas({ cols: 18.3, rows: 22.8 }, initialState().rooms), { cols: 18, rows: 23 });
  assert.deepEqual(constrainCanvas({ cols: 1, rows: 1 }, initialState().rooms), { cols: 12, rows: 14 });
  assert.deepEqual(constrainCanvas({ cols: 0, rows: 0 }, []), { cols: 6, rows: 6 });
  assert.deepEqual(constrainCanvas(null, [{ x: 20, y: 15, w: 4, h: 5 }]), { cols: 24, rows: 20 });
});

test('legacy objects keep their labels and custom object names stay independent of tasks', () => {
  assert.equal(objectName({ type: 'trash' }), 'Trash');
  assert.equal(objectName({ type: 'trash', name: 'Kitchen bin' }), 'Kitchen bin');
  assert.equal(objectName({ type: 'trash', name: '  ' }), 'Trash');
});

test('an assigned task does not mask another open task on the same object', () => {
  const tasks = [{ id: 'a', objectId: 'bin', status: 'assigned' }, { id: 'b', objectId: 'bin', status: 'open' }, { id: 'c', objectId: 'bin', status: 'done' }];
  assert.equal(primaryObjectTask(tasks, 'bin').id, 'b');
  assert.equal(objectTasks(tasks, 'bin').length, 2);
  assert.equal(objectTasks(tasks, 'other').length, 0);
});

test('rooms can share walls, but cannot overlap or leave the grid', () => {
  const rooms = [{ id: 'a', x: 0, y: 0, w: 6, h: 6 }];
  assert.equal(canPlace({ id: 'b', x: 6, y: 0, w: 6, h: 6 }, rooms), true);
  assert.equal(canPlace({ id: 'b', x: 5, y: 0, w: 6, h: 6 }, rooms), false);
  assert.equal(canPlace({ id: 'b', x: 10, y: 0, w: 4, h: 4 }, rooms), false);
  assert.equal(canPlace({ id: 'b', x: 0, y: -1, w: 4, h: 4 }, rooms), false);
  assert.equal(canPlace({ id: 'a', x: 0, y: 0, w: 3, h: 3 }, rooms), true);
  assert.equal(canPlace({ id: 'b', x: 0, y: 0, w: 2, h: 3 }, []), false);
});
test('the sample apartment contains valid non-overlapping rooms', () => {
  const { rooms } = initialState();
  for (const room of rooms) assert.ok(canPlace(room, rooms), room.name);
});
test('room addition finds space and reports a full layout', () => {
  assert.deepEqual(findSpace([]), { id: 'new', x: 0, y: 0, w: 4, h: 4 });
  assert.equal(findSpace(initialState().rooms), null);
  const rooms = [{ id: 'a', x: 0, y: 0, w: 6, h: 14 }];
  assert.equal(findSpace(rooms).x, 6);
});
test('only the recipient can accept and acceptance does not complete a task', () => {
  const task = { id: 'a', status: 'open', to: null };
  const pending = transitionTask(task, 'suggest', 'jess', 'maya');
  assert.equal(pending.status, 'pending');
  assert.equal(transitionTask(pending, 'accept', 'alex'), pending);
  const accepted = transitionTask(pending, 'accept', 'maya');
  assert.equal(accepted.status, 'assigned');
  assert.equal(transitionTask(accepted, 'complete', 'jess'), accepted);
  assert.equal(transitionTask(accepted, 'complete', 'maya').status, 'done');
});
test('declining releases a task, and only its sender can withdraw a suggestion', () => {
  const task = { status: 'pending', from: 'jess', to: 'maya' };
  assert.equal(transitionTask(task, 'cancel', 'alex'), task);
  assert.deepEqual(transitionTask(task, 'cancel', 'jess'), { status: 'open', from: 'jess', to: null });
  assert.deepEqual(transitionTask(task, 'decline', 'maya'), { status: 'open', from: 'jess', to: null });
});
test('open tasks can be claimed and already claimed tasks cannot be reassigned', () => {
  const task = { status: 'open', to: null };
  const assigned = transitionTask(task, 'claim', 'jess');
  assert.equal(assigned.to, 'jess');
  assert.equal(transitionTask(assigned, 'suggest', 'alex', 'maya'), assigned);
  assert.equal(transitionTask(task, 'suggest', 'jess', 'jess'), task);
});
test('availability expires without exposing a stale status', () => {
  assert.equal(activeStatus({ status: 'Studying', expires: 100 }, 101), 'Unknown');
  assert.equal(activeStatus({ status: 'Studying', expires: 100 }, 99), 'Studying');
});
test('saved state loads and corrupt storage falls back to a usable apartment', () => {
  const state = initialState();
  state.apartment = 'Our new home';
  assert.equal(loadState({ getItem: () => JSON.stringify(state) }).apartment, 'Our new home');
  assert.equal(loadState({ getItem: () => 'broken' }).version, 1);
  assert.equal(loadState({ getItem: () => { throw new Error('Unavailable'); } }).version, 1);
});


test('completing an item restock deletes only its task and unused marker, leaving the item in place', async () => {
  const { applyTaskAction } = await import('./model.js');
  const state = initialState();
  state.tasks = [{ id: 'restock', objectId: 'supplies1', inventoryId: 'stock-paper', status: 'assigned', to: 'jess' }];
  const item = state.inventory.find(item => item.id === 'stock-paper');
  const next = applyTaskAction(state, 'restock', 'complete', 'jess', undefined, 2);
  assert.equal(next.tasks.length, 0);
  assert.equal(next.objects.some(object => object.id === 'supplies1'), false);
  const retained = next.inventory.find(value => value.id === item.id);
  assert.equal(retained.objectId, null);
  assert.equal(retained.quantity, 2);
  assert.equal(retained.status, 'low');
  assert.ok(Number.isFinite(retained.x) && Number.isFinite(retained.y));
  assert.equal(applyTaskAction(state, 'restock', 'complete', 'maya'), state);
  state.tasks.push({ id: 'other', objectId: 'supplies1', status: 'open' });
  const shared = applyTaskAction(state, 'restock', 'complete', 'jess', undefined, 2);
  assert.ok(shared.objects.some(object => object.id === 'supplies1'));
  assert.equal(shared.tasks[0].id, 'other');
  const ordinary = { ...state, tasks: [{ id: 'ordinary', objectId: 'trash1', status: 'assigned', to: 'jess' }] };
  assert.equal(applyTaskAction(ordinary, 'ordinary', 'complete', 'jess').tasks[0].status, 'done');
});


test('restock completion validates additions and adds to the existing count only once', async () => {
  const { applyTaskAction } = await import('./model.js');
  const state = initialState();
  state.inventory = state.inventory.map(item => item.id === 'stock-paper' ? { ...item, quantity: 8, status: 'in' } : item);
  state.tasks = [{ id: 'restock', objectId: 'supplies1', inventoryId: 'stock-paper', status: 'assigned', to: 'jess' }];
  for (const amount of [undefined, 0, -1, 1.5, 99999, NaN]) assert.equal(applyTaskAction(state, 'restock', 'complete', 'jess', undefined, amount), state);
  const next = applyTaskAction(state, 'restock', 'complete', 'jess', undefined, 5);
  assert.equal(next.inventory.find(item => item.id === 'stock-paper').quantity, 13);
  assert.equal(applyTaskAction(next, 'restock', 'complete', 'jess', undefined, 5), next);
});


test('room placement commits only positions and keeps linked item positions fixed when a task moves', async () => {
  const { roomPlacementDraft, commitRoomPlacement } = await import('./model.js');
  const { inventoryPosition } = await import('./inventory.js');
  const state = initialState();
  const draft = roomPlacementDraft(state, 'bathroom');
  const originalItem = inventoryPosition(state.inventory[1], state.objects);
  draft.objects.supplies1.point = { x: 85, y: 60 };
  const refreshed = { ...state, inventory: state.inventory.map(item => item.id === 'stock-paper' ? { ...item, quantity: 12, status: 'in' } : item) };
  const next = commitRoomPlacement(refreshed, draft);
  assert.equal(next.tasks, refreshed.tasks);
  assert.equal(next.inventory[1].quantity, 12);
  assert.deepEqual(inventoryPosition(next.inventory[1], next.objects), originalItem);
  assert.equal(next.objects.find(object => object.id === 'supplies1').x, 85);
  assert.equal(next.objects.find(object => object.id === 'trash1'), state.objects.find(object => object.id === 'trash1'));
  draft.items['stock-paper'].point = { x: 30, y: 75 };
  const both = commitRoomPlacement(refreshed, draft);
  assert.deepEqual(inventoryPosition(both.inventory[1], both.objects), { x: 30, y: 75 });
  const stale = { ...state, objects: state.objects.map(object => object.id === 'supplies1' ? { ...object, x: 60 } : object) };
  assert.equal(commitRoomPlacement(stale, draft), null);
  draft.items['stock-paper'].point = { x: -10, y: 75 };
  assert.equal(commitRoomPlacement(state, draft), null);
});

test('local demo starts empty and upgrades an untouched saved sample while retaining profiles', () => {
  assert.equal(loadDemoState({ getItem: () => null }).rooms.length, 0);
  const sample = initialState();
  delete sample.demoStarterVersion;
  delete sample.demoNamesVersion;
  sample.people[0].name = 'Helen';
  const migrated = loadDemoState({ getItem: () => JSON.stringify(sample) });
  for (const key of ['rooms', 'objects', 'tasks', 'inventory']) assert.deepEqual(migrated[key], []);
  assert.equal(migrated.people[0].name, 'Helen');
  assert.deepEqual(migrated.people.slice(1).map(p => p.name), ['Roomate 1', 'Roomate 2']);
  const custom = initialState();
  custom.rooms.push({ id: 'custom', type: 'laundry', name: 'Laundry', x: 12, y: 0, w: 4, h: 4 });
  assert.deepEqual(loadDemoState({ getItem: () => JSON.stringify(custom) }).rooms, custom.rooms);
});
