import { getAvailability } from './availability.js';
import { inventoryPosition, hasQuantity, updateInventoryItem } from './inventory.js';
export const COLS = 12;
export const ROWS = 14;
export const ROOM_TYPES = {
  kitchen: { label: 'Kitchen', color: '#f3e7cd', icon: 'kitchen' },
  living: { label: 'Living room', color: '#e4eadb', icon: 'sofa' },
  bedroom: { label: 'Bedroom', color: '#e9e4ef', icon: 'bed' },
  bathroom: { label: 'Bathroom', color: '#dfeaf0', icon: 'bath' },
  laundry: { label: 'Laundry room', color: '#e2e9df', icon: 'laundry' },
  hallway: { label: 'Hallway', color: '#ebdcc3', icon: 'hallway' },
  custom: { label: 'Custom room', color: '#eee6df', icon: 'home' },
};
export const OBJECT_TYPES = {
  trash: { label: 'Trash', task: 'Take out the trash', icon: 'trash' },
  dishes: { label: 'Dishes', task: 'Do the dishes', icon: 'dishes' },
  laundry: { label: 'Laundry', task: 'Run a load of laundry', icon: 'laundry' },
  supplies: { label: 'Supplies', task: 'Restock shared supplies', icon: 'supplies' },
  cleaning: { label: 'Cleaning', task: 'Clean this space', icon: 'sparkles' },
  custom: { label: 'Other', task: '', icon: 'supplies' },
};
export const STATUSES = ['Home & free', 'Leaving soon', 'Studying', 'Away'];
export function objectName(object) { return object?.name?.trim() || OBJECT_TYPES[object?.type]?.label || 'Object'; }
export const taskNeedsAttention = task => task?.status === 'open' && task.attention !== false;
export function objectTasks(tasks, objectId) {
  return tasks.filter(t => t.objectId === objectId && t.status !== 'done');
}
export function primaryObjectTask(tasks, objectId) {
  const active = objectTasks(tasks, objectId);
  return active.find(taskNeedsAttention) || active.find(t => t.status === 'open') || active.find(t => t.status === 'pending') || active[0];
}
export function initialState() {
  return {
    version: 1,
    demoStarterVersion: 1,
    demoNamesVersion: 1,
    apartment: 'The little apartment',
    currentUser: 'jess',
    people: [
      { id: 'jess', name: 'Jessalyn', initial: 'J', color: '#eddcc8', status: null, expires: null, routine: [] },
      { id: 'maya', name: 'Maya', initial: 'M', color: '#e1e7d3', status: null, expires: null, routine: [] },
      { id: 'alex', name: 'Alex', initial: 'A', color: '#e3dcf0', status: null, expires: null, routine: [] },
    ],
    rooms: [
      { id: 'kitchen', type: 'kitchen', name: 'Kitchen', x: 0, y: 0, w: 6, h: 6 },
      { id: 'living', type: 'living', name: 'Living room', x: 6, y: 0, w: 6, h: 8 },
      { id: 'bathroom', type: 'bathroom', name: 'Bathroom', x: 0, y: 6, w: 6, h: 3 },
      { id: 'bedroom1', type: 'bedroom', name: 'Jessalyn’s room', x: 0, y: 9, w: 6, h: 5 },
      { id: 'bedroom2', type: 'bedroom', name: 'Maya & Alex’s room', x: 6, y: 8, w: 6, h: 6 },
    ],
    objects: [
      { id: 'trash1', type: 'trash', roomId: 'kitchen', x: 76, y: 72 },
      { id: 'dishes1', type: 'dishes', roomId: 'kitchen', x: 28, y: 37 },
      { id: 'supplies1', type: 'supplies', roomId: 'bathroom', x: 72, y: 53 },
      { id: 'cleaning1', type: 'cleaning', roomId: 'living', x: 48, y: 72 },
    ],
    tasks: [
      { id: 'task-trash', objectId: 'trash1', title: 'Take out the trash', status: 'open', from: 'jess', to: null },
      { id: 'task-supplies', objectId: 'supplies1', title: 'Restock toilet paper', status: 'open', from: 'alex', to: null },
    ],
    inventory: [
      { id: 'stock-bags', name: 'Trash bags', status: 'low', roomId: 'kitchen', objectId: 'trash1', notes: 'Under the kitchen sink', buyerId: null },
      { id: 'stock-paper', name: 'Toilet paper', status: 'out', roomId: 'bathroom', objectId: 'supplies1', notes: '', buyerId: null },
      { id: 'stock-soap', name: 'Dish soap', status: 'in', roomId: 'kitchen', objectId: 'dishes1', notes: '', buyerId: null },
    ],
  };
}
function demoPeople(people) {
  const names = { jess: ['Jessalyn', 'Guest'], maya: ['Maya', 'Roomate 1'], alex: ['Alex', 'Roomate 2'] };
  return people.map(person => {
    const pair = names[person.id];
    return pair && person.name === pair[0] ? { ...person, name: pair[1], initial: pair[1][0] } : person;
  });
}
export function initialGuestState() {
  const sample = initialState();
  return { ...sample, people: demoPeople(sample.people), demoStarterVersion: 1, rooms: [], objects: [], tasks: [], inventory: [], canvas: { cols: COLS, rows: ROWS } };
}

// Local-network HTTP previews do not expose crypto.randomUUID on every browser.
let idSequence = 0;
export function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `roomie-${Date.now().toString(36)}-${(++idSequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export function layoutBounds(rooms) {
  const minX = Math.min(0, ...rooms.map(r => r.x)), minY = Math.min(0, ...rooms.map(r => r.y));
  return { cols: Math.max(COLS, ...rooms.map(r => r.x + r.w)), rows: Math.max(ROWS, ...rooms.map(r => r.y + r.h)), ...(minX ? { minX } : {}), ...(minY ? { minY } : {}) };
}
export function constrainCanvas(grid, rooms) {
  const minCols = Math.max(6, ...rooms.map(r => r.x + r.w));
  const minRows = Math.max(6, ...rooms.map(r => r.y + r.h));
  const minX = Math.min(0, ...rooms.map(r => r.x), Number.isFinite(grid?.minX) ? Math.round(grid.minX) : 0);
  const minY = Math.min(0, ...rooms.map(r => r.y), Number.isFinite(grid?.minY) ? Math.round(grid.minY) : 0);
  return { cols: Math.max(minCols, Number.isFinite(grid?.cols) ? Math.round(grid.cols) : minCols), rows: Math.max(minRows, Number.isFinite(grid?.rows) ? Math.round(grid.rows) : minRows), ...(minX ? { minX } : {}), ...(minY ? { minY } : {}) };
}
export function objectPosition(objects, roomId, preferred = { x: 50, y: 58 }) {
  const candidates = [preferred, ...[32, 58, 80].flatMap(y => [22, 50, 78].map(x => ({ x, y })))];
  return candidates.find(point => !objects.some(o => o.roomId === roomId && Math.hypot(point.x - o.x, point.y - o.y) < 24)) ?? null;
}
export function canPlace(room, rooms, grid = { cols: COLS, rows: ROWS }) {
  return Number.isInteger(room.x) && Number.isInteger(room.y) && Number.isInteger(room.w) && Number.isInteger(room.h)
    && room.w >= 3 && room.h >= 3 && room.x >= (grid.minX || 0) && room.y >= (grid.minY || 0) && room.x + room.w <= grid.cols && room.y + room.h <= grid.rows
    && !rooms.some(r => r.id !== room.id && room.x < r.x + r.w && room.x + room.w > r.x && room.y < r.y + r.h && room.y + room.h > r.y);
}
export function findSpace(rooms, w = 4, h = 4, grid = { cols: COLS, rows: ROWS }) {
  for (let y = 0; y <= grid.rows - h; y++) for (let x = 0; x <= grid.cols - w; x++) {
    const room = { id: 'new', x, y, w, h };
    if (canPlace(room, rooms, grid)) return room;
  }
  return null;
}
export function transitionTask(task, action, userId, recipient) {
  if (action === 'flag' && task.status === 'open' && task.attention === false) return { ...task, attention: true };
  if (action === 'suggest' && task.status === 'open' && recipient && recipient !== userId) return { ...task, status: 'pending', from: userId, to: recipient };
  if (action === 'claim' && task.status === 'open') return { ...task, status: 'assigned', to: userId };
  if (action === 'accept' && task.status === 'pending' && task.to === userId) return { ...task, status: 'assigned' };
  if (action === 'decline' && task.status === 'pending' && task.to === userId) return { ...task, status: 'open', to: null };
  if (action === 'complete' && task.status === 'assigned' && task.to === userId) return { ...task, status: 'done' };
  if (action === 'cancel' && task.status === 'pending' && task.from === userId) return { ...task, status: 'open', to: null };
  return task;
}
export function applyTaskAction(state, taskId, action, userId, recipient, restockedQuantity) {
  const task = state.tasks.find(task => task.id === taskId);
  if (!task) return state;
  const next = transitionTask(task, action, userId, recipient);
  if (next === task) return state;
  if (action !== 'complete' || !task.inventoryId) return { ...state, tasks: state.tasks.map(task => task.id === taskId ? next : task) };
  const item = state.inventory.find(item => item.id === task.inventoryId);
  if (!item || !Number.isSafeInteger(restockedQuantity) || restockedQuantity <= 0) return state;
  const quantity = (hasQuantity(item) ? item.quantity : 0) + restockedQuantity;
  if (quantity > 99999) return state;
  return removeRestockTask({ ...state, inventory: state.inventory.map(value => value.id === item.id ? updateInventoryItem(value, { quantity }) : value) }, taskId);
}
export function removeRestockTask(state, taskId) {
  const task = state.tasks.find(task => task.id === taskId);
  if (!task?.inventoryId) return state;
  const tasks = state.tasks.filter(task => task.id !== taskId);
  const removeMarker = !tasks.some(other => other.objectId === task.objectId) && !state.inventory.some(item => item.objectId === task.objectId && item.id !== task.inventoryId);
  return { ...state, tasks,
    objects: removeMarker ? state.objects.filter(object => object.id !== task.objectId) : state.objects,
    inventory: removeMarker ? state.inventory.map(item => item.objectId === task.objectId ? { ...item, ...inventoryPosition(item, state.objects), objectId: null } : item) : state.inventory,
  };
}
export function roomPlacementDraft(state, roomId) {
  const room = state.rooms.find(room => room.id === roomId);
  if (!room) return null;
  const entry = point => ({ before: { ...point }, point: { ...point } });
  return { roomId, w: room.w, h: room.h,
    objects: Object.fromEntries(state.objects.filter(object => object.roomId === roomId).map(object => [object.id, entry({ x: object.x, y: object.y })])),
    items: Object.fromEntries(state.inventory.filter(item => item.roomId === roomId).map(item => [item.id, entry(inventoryPosition(item, state.objects))])),
  };
}
export function commitRoomPlacement(state, draft) {
  const room = state.rooms.find(room => room.id === draft.roomId);
  if (!room || room.w !== draft.w || room.h !== draft.h) return null;
  const changed = entry => entry.before.x !== entry.point.x || entry.before.y !== entry.point.y;
  const updates = { objects: new Map(), items: new Map() };
  for (const kind of ['objects', 'items']) for (const [id, entry] of Object.entries(draft[kind])) {
    if (!changed(entry)) continue;
    const record = (kind === 'objects' ? state.objects : state.inventory).find(record => record.id === id && record.roomId === room.id);
    if (!record) return null;
    const current = kind === 'items' ? inventoryPosition(record, state.objects) : record;
    const { x, y } = entry.point;
    if (current.x !== entry.before.x || current.y !== entry.before.y || !Number.isFinite(x) || !Number.isFinite(y) || x < 10 || x > 90 || y < 18 || y > 88) return null;
    updates[kind].set(id, { x, y });
  }
  return { ...state,
    objects: state.objects.map(object => updates.objects.has(object.id) ? { ...object, ...updates.objects.get(object.id) } : object),
    inventory: state.inventory.map(item => {
      const moved = updates.items.get(item.id);
      if (moved) return { ...item, ...moved };
      // Legacy item positions may be derived from their linked task. Moving the
      // task alone must not move the item that stayed stationary in the preview.
      const original = draft.items[item.id];
      if (original && updates.objects.has(item.objectId) && (!Number.isFinite(item.x) || !Number.isFinite(item.y))) return { ...item, ...inventoryPosition(item, state.objects) };
      return item;
    }),
  };
}
export function activeStatus(person, now = Date.now()) {
  return getAvailability(person, now).status;
}
export function loadState(storage, fallback = initialState) {
  try {
    const state = JSON.parse(storage.getItem('roomie-v1'));
    if (state?.version === 1 && Array.isArray(state.rooms) && Array.isArray(state.objects) && Array.isArray(state.people) && Array.isArray(state.tasks) && state.people.some(p => p.id === state.currentUser)) return { ...state, inventory: Array.isArray(state.inventory) ? state.inventory : [] };
  } catch { /* A fresh apartment is available if browser storage is unavailable. */ }
  return fallback();
}

// Upgrade the untouched sample apartment without discarding a custom layout.
export function loadDemoState(storage) {
  let state = loadState(storage, initialGuestState);
  if (state.cloud) return state;
  if (!state.demoNamesVersion) state = { ...state, people: demoPeople(state.people), demoNamesVersion: 1 };
  if (state.demoStarterVersion) return state;
  const sample = initialState();
  const untouched = ['rooms', 'objects', 'tasks', 'inventory'].every(key => JSON.stringify(state[key]) === JSON.stringify(sample[key]));
  return untouched ? { ...state, rooms: [], objects: [], tasks: [], inventory: [], canvas: initialGuestState().canvas, demoStarterVersion: 1 } : { ...state, demoStarterVersion: 1 };
}
