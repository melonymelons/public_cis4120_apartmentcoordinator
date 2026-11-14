import test from 'node:test';
import assert from 'node:assert/strict';
import { claimInventoryItem, restockTasksForItem, nearbyRestockPosition, restockAssignee, updateInventoryItem, adjustQuantity, hasQuantity, inventoryPosition } from './inventory.js';
import { initialState, loadState } from './model.js';

test('purchase claims can be taken and released by their owner, without overwriting someone else', () => {
  const item = { id: 'soap', status: 'out', buyerId: null };
  const claimed = claimInventoryItem(item, 'jess');
  assert.equal(claimed.buyerId, 'jess');
  assert.equal(claimInventoryItem(claimed, 'maya'), claimed);
  assert.equal(claimInventoryItem(claimed, 'jess').buyerId, null);
  assert.equal(claimInventoryItem({ ...item, status: 'in' }, 'jess').buyerId, null);
});

test('restocking clears purchase claims while edits to low-stock items preserve them', () => {
  const item = { id: 'soap', status: 'out', buyerId: 'jess' };
  assert.equal(updateInventoryItem(item, { status: 'in' }).buyerId, null);
  assert.equal(updateInventoryItem(item, { status: 'low' }).buyerId, 'jess');
  assert.equal(updateInventoryItem(item, { name: 'Dish soap' }).buyerId, 'jess');
});

test('older saved apartments gain an empty inventory without losing existing data', () => {
  const state = initialState();
  delete state.inventory;
  const loaded = loadState({ getItem: () => JSON.stringify(state) });
  assert.deepEqual(loaded.inventory, []);
  assert.deepEqual(loaded.rooms, state.rooms);
  assert.deepEqual(loaded.tasks, state.tasks);
});

test('counts determine stock level, stop at zero, and clear claims when replenished', () => {
  const item = { id: 'paper', quantity: 3, lowAt: 2, unit: 'rolls', status: 'in', buyerId: null };
  const low = adjustQuantity(item, -1);
  assert.equal(low.quantity, 2);
  assert.equal(low.status, 'low');
  const claimed = claimInventoryItem(low, 'jess');
  assert.equal(adjustQuantity(claimed, 1).buyerId, null);
  const empty = adjustQuantity(claimed, -2);
  assert.equal(empty.status, 'out');
  assert.equal(adjustQuantity(empty, -1).quantity, 0);
  assert.equal(updateInventoryItem(item, { lowAt: 4 }).status, 'low');
  assert.equal(updateInventoryItem(item, { quantity: 0 }).status, 'out');
});

test('uncounted supplies stay uncounted and manual stock tracking remains available', () => {
  const item = { id: 'soap', status: 'low' };
  assert.equal(hasQuantity(item), false);
  assert.equal(adjustQuantity(item, 1), item);
  assert.equal(hasQuantity({ quantity: null }), false);
  assert.equal(hasQuantity({ quantity: -1 }), false);
  assert.equal(hasQuantity({ quantity: 1.5 }), false);
  assert.equal(updateInventoryItem({ ...item, quantity: 8 }, { quantity: null, status: 'out' }).status, 'out');
});

test('item coordinates stay exact and fallback positions do not depend on the surrounding items', () => {
  const item = { id: 'soap', roomId: 'bath', x: 31.5, y: 62.25 };
  assert.deepEqual(inventoryPosition(item), { x: 31.5, y: 62.25 });
  assert.deepEqual(inventoryPosition(item, [{ id: 'new', x: 31.5, y: 62.25 }]), { x: 31.5, y: 62.25 });
  const legacy = { id: 'legacy', roomId: 'bath' };
  assert.deepEqual(inventoryPosition(legacy, []), inventoryPosition(legacy, [{ id: 'unrelated', x: 20, y: 30 }]));
  assert.deepEqual(inventoryPosition({ ...item, x: 150, y: -10 }), { x: 90, y: 18 });
});


test('restock marker ownership follows assigned tasks and legacy links without treating pending suggestions as assigned', () => {
  const item = { id: 'paper', name: 'Toilet paper', objectId: 'rolls', status: 'out', buyerId: null };
  const task = { inventoryId: 'paper', objectId: 'rolls', title: 'Restock toilet paper', status: 'assigned', to: 'maya' };
  assert.equal(restockAssignee(item, [task]), 'maya');
  assert.equal(restockAssignee(item, [{ ...task, inventoryId: undefined }]), 'maya');
  assert.equal(restockAssignee(item, [{ ...task, inventoryId: 'different-item' }]), null);
  assert.equal(restockAssignee(item, [{ ...task, status: 'pending' }]), null);
  assert.equal(restockAssignee(item, [{ ...task, status: 'done' }]), null);
  assert.equal(restockAssignee({ ...item, buyerId: 'alex' }, []), 'alex');
  assert.equal(restockAssignee({ ...item, status: 'in' }, [task]), null);
});


test('new restock positions stay near their item and avoid occupied neighbors and room edges', () => {
  const item = { id: 'paper', roomId: 'bath', x: 30, y: 55 };
  assert.deepEqual(nearbyRestockPosition(item, [], [item]), { x: 58, y: 55 });
  const objects = [{ id: 'occupied', roomId: 'bath', x: 58, y: 55 }];
  const chosen = nearbyRestockPosition(item, objects, [item]);
  assert.ok(chosen && Math.hypot(chosen.x - item.x, chosen.y - item.y) <= 35);
  assert.ok(Math.hypot(chosen.x - 58, chosen.y - 55) >= 24);
  assert.deepEqual(nearbyRestockPosition({ ...item, x: 88 }, [], []), { x: 60, y: 55 });
  assert.deepEqual(restockTasksForItem(item, [{ inventoryId: item.id, status: 'done' }, { inventoryId: 'other', status: 'open' }]), []);
});
