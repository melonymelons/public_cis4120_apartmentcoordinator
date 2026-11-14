import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, canPlace, layoutBounds } from './model.js';
import { layoutDraft, addRoomToDraft, commitLayout, resolveRoomDrop } from './layout.js';

const moving = { id: 'moving', type: 'custom', name: 'Study', x: 0, y: 8, w: 3, h: 3 };
const obstacle = { id: 'obstacle', x: 4, y: 4, w: 4, h: 4 };
const dropRooms = [moving, obstacle], dropGrid = { cols: 16, rows: 16 };

test('a slight edge overlap snaps to the clearly nearest free position without changing other rooms', () => {
  const before = structuredClone(dropRooms);
  const result = resolveRoomDrop({ ...moving, x: 2, y: 4 }, dropRooms, dropGrid);
  assert.deepEqual(result, { ...moving, x: 1, y: 4 });
  assert.deepEqual(dropRooms, before);
  assert.ok(canPlace(result, dropRooms, dropGrid));
});

test('fractional drop positions choose the nearest cell along an obvious free edge', () => {
  const result = resolveRoomDrop({ ...moving, x: 2, y: 5 }, dropRooms, dropGrid, { x: 2.1, y: 4.6 });
  assert.deepEqual(result, { ...moving, x: 1, y: 5 });
});

test('equally plausible or nearly tied corrections keep the existing invalid-drop behavior', () => {
  assert.equal(resolveRoomDrop({ ...moving, x: 2, y: 2 }, dropRooms, dropGrid), null);
  assert.equal(resolveRoomDrop({ ...moving, x: 2, y: 2 }, dropRooms, dropGrid, { x: 2.2, y: 2 }), null);
});

test('deep overlaps do not send rooms to distant empty space, and valid drops are unchanged', () => {
  assert.equal(resolveRoomDrop({ ...moving, x: 5, y: 5 }, dropRooms, dropGrid), null);
  const valid = { ...moving, x: 8, y: 4 };
  assert.equal(resolveRoomDrop(valid, dropRooms, dropGrid), valid);
});

test('Edit includes space above and left; negative room positions save without moving other rooms', () => {
  const state = initialState(), draft = layoutDraft(state);
  const moved = { ...draft.rooms[0], x: -6, y: -6, w: 8, h: 6 };
  assert.ok(canPlace(moved, draft.rooms, draft.canvas));
  draft.rooms[0] = moved;
  const saved = commitLayout(state, draft);
  assert.deepEqual(saved.rooms[0], moved);
  assert.deepEqual(saved.rooms.slice(1), state.rooms.slice(1));
  assert.equal(saved.canvas.minX, -6);
  assert.equal(saved.canvas.minY, -6);
  assert.ok(canPlace(saved.rooms[0], saved.rooms, saved.canvas));
  assert.deepEqual(commitLayout(state, layoutDraft(state)).canvas, state.canvas || layoutBounds(state.rooms));
});

test('adding rooms finds free space and extends the workspace without changing the apartment until saved', () => {
  const state = initialState();
  let draft = layoutDraft(state);
  for (let i = 0; i < 12; i++) draft = addRoomToDraft(draft, 'bedroom', `new-${i}`);
  assert.equal(state.rooms.length, 5);
  assert.equal(draft.rooms.length, 17);
  assert.ok(draft.rooms.every(room => canPlace(room, draft.rooms, draft.canvas)));
  const saved = commitLayout(state, draft);
  assert.equal(saved.rooms.length, 17);
  assert.deepEqual(saved.objects, state.objects);
  assert.deepEqual(saved.tasks, state.tasks);
});

test('room changes preserve attached objects and the latest task and stock data', () => {
  const state = initialState();
  const draft = layoutDraft(state);
  draft.rooms[0] = { ...draft.rooms[0], x: 12, name: ' Our kitchen ' };
  const latest = { ...state, tasks: state.tasks.map(task => ({ ...task, status: 'assigned', to: 'jess' })), inventory: state.inventory.map(item => ({ ...item, quantity: 7 })) };
  const saved = commitLayout(latest, draft);
  assert.equal(saved.rooms[0].x, 12);
  assert.equal(saved.rooms[0].name, 'Our kitchen');
  assert.deepEqual(saved.objects, state.objects);
  assert.deepEqual(saved.tasks, latest.tasks);
  assert.equal(saved.inventory[0].quantity, 7);
});

test('deleting a room removes its objects/tasks and preserves supplies with cleared room links', () => {
  const state = initialState();
  const draft = layoutDraft(state);
  draft.rooms = draft.rooms.filter(room => room.id !== 'kitchen');
  const saved = commitLayout(state, draft);
  assert.ok(saved.objects.every(object => object.roomId !== 'kitchen'));
  assert.ok(saved.tasks.every(task => task.objectId !== 'trash1'));
  assert.equal(saved.inventory.length, state.inventory.length);
  assert.equal(saved.inventory[0].roomId, null);
  assert.equal(saved.inventory[0].objectId, null);
});

test('overlapping placements and stale layouts are rejected without overwriting the apartment', () => {
  const state = initialState();
  const draft = layoutDraft(state);
  draft.rooms[0].x = 1;
  assert.equal(commitLayout(state, draft), null);
  const stale = layoutDraft(state);
  assert.equal(commitLayout({ ...state, rooms: state.rooms.slice(1) }, stale), null);
  assert.equal(addRoomToDraft(stale, 'missing', 'x'), null);
});
