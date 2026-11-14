import { ROOM_TYPES, canPlace, constrainCanvas, findSpace, layoutBounds } from './model.js';

const sizes = { kitchen: [6, 6], living: [6, 8], bedroom: [6, 5], bathroom: [6, 3], laundry: [5, 4], hallway: [3, 8], custom: [4, 4] };

export function resolveRoomDrop(room, rooms, grid, position = room) {
  if (canPlace(room, rooms, grid)) return room;
  const radius = Math.min(2, Math.max(1.5, Math.min(room.w, room.h) / 4));
  const candidates = [];
  for (let y = Math.max(grid.minY || 0, Math.ceil(position.y - radius)); y <= Math.min(grid.rows - room.h, Math.floor(position.y + radius)); y++) {
    for (let x = Math.max(grid.minX || 0, Math.ceil(position.x - radius)); x <= Math.min(grid.cols - room.w, Math.floor(position.x + radius)); x++) {
      const next = { ...room, x, y }, dx = x - position.x, dy = y - position.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= radius && canPlace(next, rooms, grid)) {
        const direction = Math.abs(dx) >= Math.abs(dy) ? `x:${Math.sign(dx)}` : `y:${Math.sign(dy)}`;
        candidates.push({ room: next, distance, direction });
      }
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const best = candidates[0];
  if (!best) return null;
  // Neighboring cells along the same edge express the same intention. A close
  // alternative on a different side is ambiguous, so leave the choice to the user.
  const alternative = candidates.find(candidate => candidate.direction !== best.direction);
  if (alternative && alternative.distance - best.distance < .35) return null;
  return best.room;
}

export function layoutDraft(state) {
  const originalGrid = constrainCanvas(state.canvas || layoutBounds(state.rooms), state.rooms);
  const paddingX = Math.max(4, ...state.rooms.map(room => room.w)), paddingY = Math.max(4, ...state.rooms.map(room => room.h));
  return {
    rooms: state.rooms.map(room => ({ ...room })), originalGrid,
    canvas: { cols: originalGrid.cols + paddingX, rows: originalGrid.rows + paddingY, minX: (originalGrid.minX || 0) - paddingX, minY: (originalGrid.minY || 0) - paddingY },
    baseRooms: JSON.stringify(state.rooms), baseCanvas: JSON.stringify(state.canvas),
    addedObjects: [], addedTasks: [], addedInventory: [],
  };
}

export function addRoomToDraft(draft, type, id) {
  if (!ROOM_TYPES[type] || !id || draft.rooms.some(room => room.id === id)) return null;
  const [w, h] = sizes[type];
  let canvas = { ...draft.canvas, cols: Math.max(w, draft.canvas.cols) };
  let position = findSpace(draft.rooms, w, h, canvas);
  if (!position) {
    canvas = { ...canvas, rows: canvas.rows + h + 2 };
    position = findSpace(draft.rooms, w, h, canvas);
  }
  if (!position) return null;
  const room = { ...position, id, type, name: ROOM_TYPES[type].label };
  return { ...draft, canvas, rooms: [...draft.rooms, room] };
}

export function commitLayout(state, draft) {
  if (JSON.stringify(state.rooms) !== draft.baseRooms || JSON.stringify(state.canvas) !== draft.baseCanvas) return null;
  const rooms = draft.rooms.map(room => ({ ...room, name: room.name.trim() }));
  if (new Set(rooms.map(room => room.id)).size !== rooms.length || rooms.some(room => !ROOM_TYPES[room.type] || !room.name || !canPlace(room, rooms, draft.canvas))) return null;
  const bounds = layoutBounds(rooms);
  const canvas = constrainCanvas({ cols: Math.max(draft.originalGrid.cols, bounds.cols), rows: Math.max(draft.originalGrid.rows, bounds.rows), minX: Math.min(draft.originalGrid.minX || 0, bounds.minX || 0), minY: Math.min(draft.originalGrid.minY || 0, bounds.minY || 0) }, rooms);
  const validRooms = new Set(rooms.map(room => room.id));
  const objects = [...state.objects, ...(draft.addedObjects || [])].filter(object => validRooms.has(object.roomId));
  const validObjects = new Set(objects.map(object => object.id));
  return {
    ...state, rooms, canvas, objects,
    tasks: [...state.tasks, ...(draft.addedTasks || [])].filter(task => validObjects.has(task.objectId)),
    inventory: [...state.inventory, ...(draft.addedInventory || [])].map(item => ({ ...item, roomId: validRooms.has(item.roomId) ? item.roomId : null, objectId: validObjects.has(item.objectId) ? item.objectId : null })),
  };
}
