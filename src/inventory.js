export const STOCK_LEVELS = {
  in: { label: 'In stock', icon: 'check' },
  low: { label: 'Running low', icon: 'clock' },
  out: { label: 'Out of stock', icon: 'close' },
  unknown: { label: 'Not checked', icon: 'question' },
};
export const needsRestocking = item => item.status === 'low' || item.status === 'out';
export const restockTasksForItem = (item, tasks = []) => tasks.filter(task => task.status !== 'done' && (
  task.inventoryId === item.id || (!task.inventoryId && item.objectId && task.objectId === item.objectId && task.title?.toLowerCase() === `Restock ${item.name}`.toLowerCase())
));
export function nearbyRestockPosition(item, objects = [], inventory = []) {
  const origin = inventoryPosition(item, objects);
  const offsets = [[28, 0], [-28, 0], [0, 28], [0, -28], [24, 24], [-24, 24], [24, -24], [-24, -24]];
  return offsets.map(([dx, dy]) => ({ x: origin.x + dx, y: origin.y + dy })).find(point =>
    point.x >= 10 && point.x <= 90 && point.y >= 18 && point.y <= 88 &&
    !objects.some(object => object.roomId === item.roomId && Math.hypot(point.x - object.x, point.y - object.y) < 24) &&
    !inventory.some(other => other.roomId === item.roomId && Math.hypot(point.x - inventoryPosition(other, objects).x, point.y - inventoryPosition(other, objects).y) < 25)
  ) || null;
}
export function restockAssignee(item, tasks = []) {
  if (!needsRestocking(item)) return null;
  const assigned = restockTasksForItem(item, tasks).find(task => task.status === 'assigned' && task.to);
  return assigned?.to || item.buyerId || null;
}
export const hasQuantity = item => Number.isSafeInteger(item.quantity) && item.quantity >= 0;
export const quantityLabel = item => hasQuantity(item) ? `${item.quantity} ${item.unit || 'items'}` : 'Set quantity';
export function inventoryPosition(item, objects = []) {
  if (Number.isFinite(item.x) && Number.isFinite(item.y)) return { x: Math.max(10, Math.min(90, item.x)), y: Math.max(18, Math.min(88, item.y)) };
  const linked = objects.find(object => object.id === item.objectId && object.roomId === item.roomId);
  if (linked) return { x: Math.max(10, Math.min(90, linked.x + (linked.x > 60 ? -22 : 22))), y: Math.max(18, Math.min(88, linked.y)) };
  // Older supplies have no coordinates. Their fallback depends only on their ID,
  // so adding or removing another supply never reshuffles their location.
  let hash = 0;
  for (const character of String(item.id || item.name || 'supply')) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return { x: 22 + hash % 5 * 14, y: 24 + Math.floor(hash / 5) % 4 * 17 };
}
export function quantityStatus(quantity, lowAt = 2) {
  return quantity === 0 ? 'out' : quantity <= lowAt ? 'low' : 'in';
}
export function updateInventoryItem(item, patch) {
  const updated = { ...item, ...patch };
  if (hasQuantity(updated)) updated.status = quantityStatus(updated.quantity, updated.lowAt ?? 2);
  if (!needsRestocking(updated)) updated.buyerId = null;
  return updated;
}
export function adjustQuantity(item, delta) {
  if (!hasQuantity(item)) return item;
  const quantity = Math.max(0, Math.min(99999, item.quantity + delta));
  return updateInventoryItem(item, { quantity });
}
export function claimInventoryItem(item, userId) {
  if (!needsRestocking(item) || (item.buyerId && item.buyerId !== userId)) return item;
  return { ...item, buyerId: item.buyerId === userId ? null : userId };
}
