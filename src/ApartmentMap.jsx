import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, flash } from './motion';
import { needsRestocking, inventoryPosition, hasQuantity, quantityLabel, STOCK_LEVELS } from './inventory';
import { SupplyIcon } from './SupplyQuantity';
import { resolveRoomDrop } from './layout';
import { canReceiveTask } from './availability';
import Icon, { Furniture } from './Icons';
import RestockConnections from './RestockConnections';
import { ResponsibilityCharacters } from './Avatar';
import { ROOM_TYPES, OBJECT_TYPES, canPlace, layoutBounds, objectName, objectTasks, primaryObjectTask, taskNeedsAttention, constrainCanvas } from './model';

export default function ApartmentMap({ rooms, objects = [], tasks = [], editing = false, markerEditing = false, onMarkerMove, onMarkerDrag, grid = layoutBounds(rooms), frameGrid, selected, onSelect, onMove, onRemove, onResizeCanvas, onObject, onItem, selectedItemId, onTaskDrop, onTaskDropRejected, onTaskDrag, onDragAnnouncement, onInvalid, inventory = [], people = [], onRoom, showTaskLabels = false, showObjectLabels = false }) {
  const { cols: maxX, rows: maxY, minX = 0, minY = 0 } = grid;
  const COLS = maxX - minX, ROWS = maxY - minY;
  const map = useRef(null);
  const gesture = useRef(null);
  const canvasGesture = useRef(null);
  const [cellSize, setCellSize] = useState(null);
  const [roomDrag, setRoomDrag] = useState(null);
  useEffect(() => { if (!editing) { gesture.current = null; setRoomDrag(null); } }, [editing]);
  const activeDrag = useRef(null);
  const latestPeople = useRef(people);
  latestPeople.current = people;
  const markerGesture = useRef(null);
  useEffect(() => { if (!markerEditing) markerGesture.current = null; }, [markerEditing]);
  const markerPoint = point => ({ x: Math.max(10, Math.min(90, point.x)), y: Math.max(18, Math.min(88, point.y)) });
  function startMarker(event, kind, id, point) {
    if (event.button !== 0 || markerGesture.current) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    markerGesture.current = { pointerId: event.pointerId, kind, id, before: point, x: event.clientX, y: event.clientY, parent: event.currentTarget.offsetParent };
    event.currentTarget.setPointerCapture(event.pointerId);
    onMarkerDrag?.(true);
  }
  function moveMarker(event) {
    const drag = markerGesture.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = drag.parent.getBoundingClientRect();
    onMarkerMove(drag.kind, drag.id, markerPoint({ x: drag.before.x + (event.clientX - drag.x) / rect.width * 100, y: drag.before.y + (event.clientY - drag.y) / rect.height * 100 }));
  }
  function endMarker(event) {
    const drag = markerGesture.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.type !== 'pointerup') onMarkerMove(drag.kind, drag.id, drag.before);
    markerGesture.current = null;
    onMarkerDrag?.(false);
  }
  function markerKeys(event, kind, id, point) {
    if (!markerEditing) return;
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 8 : 2;
    onMarkerMove(kind, id, markerPoint({ x: point.x + direction[0] * step, y: point.y + direction[1] * step }));
  }
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; activeDrag.current?.(); }; }, []);
  useLayoutEffect(() => {
    if (editing && onResizeCanvas && !cellSize) {
      const rect = map.current.getBoundingClientRect();
      const viewport = map.current.parentElement;
      setCellSize(Math.min(rect.width / COLS, Math.max(1, viewport.clientHeight - 12) / ROWS));
    }
  }, [editing, onResizeCanvas, cellSize, COLS, ROWS]);

  function begin(event, room, resize = false) {
    if (!editing || event.button !== 0 || event.target.closest('.object-pin,.supply-map-pin')) return;
    if (gesture.current && gesture.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(room.id);
    const rect = map.current.getBoundingClientRect();
    gesture.current = { room: { ...room }, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, cellX: rect.width / COLS, cellY: rect.height / ROWS, scale: rect.width / map.current.offsetWidth, resize, changed: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event) {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    const dx = Math.round((event.clientX - g.startX) / g.cellX);
    const dy = Math.round((event.clientY - g.startY) / g.cellY);
    g.dropPosition = { x: g.room.x + (event.clientX - g.startX) / g.cellX, y: g.room.y + (event.clientY - g.startY) / g.cellY };
    const next = g.resize ? { ...g.room, w: Math.max(3, Math.min(maxX - g.room.x, g.room.w + dx)), h: Math.max(3, Math.min(maxY - g.room.y, g.room.h + dy)) } : { ...g.room, x: Math.max(minX, Math.min(maxX - g.room.w, g.room.x + dx)), y: Math.max(minY, Math.min(maxY - g.room.h, g.room.y + dy)) };
    const valid = canPlace(next, rooms, grid);
    g.next = next; g.invalid = !valid;
    if (!g.resize) {
      const x = Math.max(minX, Math.min(maxX - g.room.w, g.dropPosition.x));
      const y = Math.max(minY, Math.min(maxY - g.room.h, g.dropPosition.y));
      g.visual = { id: g.room.id, x: (x - g.room.x) * g.cellX / g.scale, y: (y - g.room.y) * g.cellY / g.scale, invalid: !valid };
      setRoomDrag(g.visual);
    } else if (valid) { onMove(next); g.changed = true; event.currentTarget.closest('.map-room')?.classList.remove('placement-blocked'); }
    else event.currentTarget.closest('.map-room')?.classList.add('placement-blocked');
  }
  function end(event) {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    const cancelled = event.type === 'pointercancel';
    const el = event.currentTarget.closest('.map-room');
    if (!g.resize && g.visual) {
      const resolved = !cancelled ? resolveRoomDrop(g.next, rooms, grid, g.dropPosition) : null;
      const next = resolved || g.room;
      if (resolved) g.invalid = false;
      const x = g.visual.x - (next.x - g.room.x) * g.cellX / g.scale;
      const y = g.visual.y - (next.y - g.room.y) * g.cellY / g.scale;
      if (next !== g.room) onMove(next);
      animate(el, [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }], { duration: 160 });
    }
    if (cancelled && g.resize && g.changed) onMove(g.room);
    if (!cancelled && g.invalid) onInvalid?.('Rooms need their own space. Try a different position.');
    el?.classList.remove('placement-blocked');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gesture.current = null; setRoomDrag(null);
  }

  function beginCanvasResize(event) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const rect = map.current.getBoundingClientRect();
    canvasGesture.current = { grid: { ...grid }, x: event.clientX, y: event.clientY, cellX: rect.width / COLS, cellY: rect.height / ROWS };
    event.currentTarget.setPointerCapture(event.pointerId);
    map.current.classList.add('canvas-resizing');
  }
  function moveCanvasResize(event) {
    const start = canvasGesture.current;
    if (!start) return;
    onResizeCanvas(constrainCanvas({ cols: start.grid.cols + (event.clientX - start.x) / start.cellX, rows: start.grid.rows + (event.clientY - start.y) / start.cellY }, rooms));
  }
  function endCanvasResize(event, cancelled = false) {
    if (cancelled && canvasGesture.current) onResizeCanvas(canvasGesture.current.grid);
    canvasGesture.current = null;
    map.current?.classList.remove('canvas-resizing');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    requestAnimationFrame(() => {
      const viewport = map.current?.parentElement;
      if (viewport) { viewport.scrollLeft = viewport.scrollWidth; viewport.scrollTop = viewport.scrollHeight; }
    });
  }

  function startObject(event, object) {
    if (editing || !onTaskDrop || event.button !== 0) return;
    activeDrag.current?.();
    const el = event.currentTarget;
    delete el.dataset.suppressClick;
    const task = tasks.find(t => t.objectId === object.id && t.status === 'open');
    if (!task) return;
    const pointerId = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    let point = start, lastX = start.x, dragging = false, proxy = null, frame = null, target = null, hovered = null, finished = false;
    el.setPointerCapture(pointerId);
    function highlight() {
      const over = document.elementFromPoint(point.x, point.y)?.closest('[data-person]');
      const next = over && canReceiveTask(latestPeople.current.find(person => person.id === over.dataset.person)) ? over : null;
      document.querySelectorAll('[data-person]').forEach(card => card.classList.toggle('drop-ready', card === next));
      if (next !== target || over !== hovered) {
        target = next; hovered = over;
        onDragAnnouncement?.(target ? `Release to ${target.dataset.self === 'true' ? 'take this task' : `suggest ${task.title} to ${target.dataset.personName}`}.` : over ? `${over.dataset.personName} is busy. Choose another roommate.` : 'Drop onto a roommate, or press Escape to cancel.');
      }
    }
    function scroll() {
      const bottom = window.innerHeight - 96;
      const dy = point.y < 70 ? -Math.min(16, (70 - point.y) / 4) : point.y > bottom ? Math.min(16, (point.y - bottom) / 4) : 0;
      if (dy) { window.scrollBy(0, dy); highlight(); }
      frame = requestAnimationFrame(scroll);
    }
    function drag(e) {
      point = { x: e.clientX, y: e.clientY };
      if (!dragging && Math.hypot(point.x - start.x, point.y - start.y) > 12) {
        dragging = true;
        const bounds = el.getBoundingClientRect();
        proxy = el.cloneNode(true);
        proxy.classList.remove('dragging');
        proxy.classList.add('task-drag-proxy');
        proxy.removeAttribute('title');
        proxy.setAttribute('aria-hidden', 'true');
        proxy.tabIndex = -1;
        const zoom = bounds.width / el.offsetWidth;
        const fontSize = parseFloat(getComputedStyle(el).fontSize) * zoom;
        Object.assign(proxy.style, { width: `${bounds.width}px`, height: `${bounds.height}px`, fontSize: `${fontSize}px` });
        // The drag copy leaves the room container and camera. Preserve the
        // on-screen dimensions of its icon, badges, and assigned characters.
        const originalParts = [...el.querySelectorAll('*')];
        [...proxy.querySelectorAll('*')].forEach((part, i) => {
          const style = getComputedStyle(originalParts[i]);
          for (const property of ['width', 'height', 'fontSize', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']) {
            const value = parseFloat(style[property]);
            if (Number.isFinite(value)) part.style[property] = `${value * zoom}px`;
          }
        });
        document.body.append(proxy);
        el.classList.add('dragging');
        document.body.classList.add('task-dragging');
        onTaskDrag?.(task);
        onDragAnnouncement?.(`Dragging ${task.title}. Drop onto a roommate, or press Escape to cancel.`);
        frame = requestAnimationFrame(scroll);
      }
      if (dragging) {
        Object.assign(proxy.style, { left: `${point.x}px`, top: `${point.y}px`, transform: `rotate(${Math.max(-7, Math.min(7, (point.x - lastX) * .35))}deg) scale(1.12)` });
        lastX = point.x;
        highlight();
      }
    }
    function finish(e, cancelled = false) {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', drag);
      el.removeEventListener('pointerup', finish);
      el.removeEventListener('pointercancel', cancel);
      document.removeEventListener('keydown', key);
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      const over = !cancelled && dragging ? document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-person]') : null;
      const card = over && canReceiveTask(latestPeople.current.find(person => person.id === over.dataset.person)) ? over : null;
      const destination = card?.querySelector('.tray-slot') || el;
      const rect = destination.getBoundingClientRect();
      document.body.classList.remove('task-dragging');
      document.querySelectorAll('[data-person]').forEach(card => card.classList.remove('drop-ready'));
      el.classList.remove('dragging');
      if (live.current) onTaskDrag?.(null);
      activeDrag.current = null;
      if (!dragging) return;
      el.dataset.suppressClick = 'true';
      if (live.current && over && !card) onTaskDropRejected?.(over.dataset.personName);
      if (live.current) onDragAnnouncement?.(card ? `Dropped on ${card.dataset.personName}.` : over ? `${over.dataset.personName} is busy. Task returned to the apartment.` : 'Drag cancelled. Task returned to the apartment.');
      const travel = animate(proxy, [
        { left: proxy.style.left, top: proxy.style.top, transform: proxy.style.transform, opacity: 1 },
        { left: `${rect.left + (card ? Math.min(23, rect.width / 2) : rect.width / 2)}px`, top: `${rect.top + rect.height / 2}px`, transform: card ? 'rotate(0deg) scale(.65)' : 'rotate(0deg) scale(1)', opacity: card ? 0 : .3 },
      ], { duration: card ? 190 : 240 });
      if (card) flash(card, 'drop-landed');
      travel.finally(() => { proxy?.remove(); if (card && live.current) onTaskDrop(task, card.dataset.person); });
    }
    function cancel(e) { finish(e, true); }
    function key(e) { if (e.key === 'Escape') { e.preventDefault(); cancel(e); } }
    activeDrag.current = () => cancel({ clientX: point.x, clientY: point.y });
    el.addEventListener('pointermove', drag);
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', cancel);
    document.addEventListener('keydown', key);
  }

  return <div className={`map-canvas ${editing ? 'is-editing' : ''} ${markerEditing ? 'is-editing-markers' : ''}`} style={{ '--grid-cols': COLS, '--grid-rows': ROWS, aspectRatio: `${COLS} / ${ROWS}`, ...(editing && cellSize ? { width: COLS * cellSize, height: ROWS * cellSize, maxWidth: 'none' } : {}), ...(frameGrid ? { position: 'absolute', left: `${(minX - (frameGrid.minX || 0)) / frameGrid.cols * 100}%`, top: `${(minY - (frameGrid.minY || 0)) / frameGrid.rows * 100}%`, width: `${COLS / frameGrid.cols * 100}%`, height: `${ROWS / frameGrid.rows * 100}%` } : {}) }} data-cols={COLS} data-rows={ROWS} ref={map} aria-label={editing ? 'Apartment layout editor' : 'Your apartment map'}>
    {rooms.length === 0 && <div className="map-empty"><Icon name="home" size={40}/><strong>No rooms added</strong><span>Add a room to start your layout.</span></div>}
    {rooms.map(room => <div key={room.id} data-room={room.id} className={`map-room ${selected === room.id ? 'selected' : ''} ${roomDrag?.id === room.id ? `room-in-motion ${roomDrag.invalid ? 'placement-blocked' : ''}` : ''}`} style={{ left: `${(room.x - minX) / COLS * 100}%`, top: `${(room.y - minY) / ROWS * 100}%`, width: `${room.w / COLS * 100}%`, height: `${room.h / ROWS * 100}%`, '--room-color': ROOM_TYPES[room.type].color, ...(roomDrag?.id === room.id ? { transform: `translate(${roomDrag.x}px, ${roomDrag.y}px)` } : {}) }} onPointerDown={e => begin(e, room)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <Furniture type={room.type} aspect={room.w / room.h}/>
      <RestockConnections items={inventory.filter(item => item.roomId === room.id)} objects={objects} tasks={tasks}/>
      {!editing && onRoom && <button className="room-open-surface" aria-label={`Open ${room.name}`} onClick={() => onRoom(room.id)}><span className="room-expand"><Icon name="expand" size={13}/></span></button>}
      {editing && <button className="room-drag-surface" onClick={() => onSelect(room.id)} aria-label={`Move ${room.name}`} aria-pressed={selected === room.id} onKeyDown={e => {
        const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!delta) return;
        e.preventDefault();
        const next = { ...room, x: room.x + delta[0], y: room.y + delta[1] };
        if (canPlace(next, rooms, grid)) onMove(next);
        else onInvalid?.('That position overlaps another room or extends beyond the workspace.');
      }}/>}
      <span className={`room-label ${editing ? 'edit-room-label' : ''}`}>{room.name}</span>
      {editing && <button type="button" className="room-delete" aria-label={`Delete ${room.name}`} title={`Delete ${room.name}`} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRemove(room.id); }}><Icon name="close" size={10} strokeWidth={2}/></button>}
      {objects.filter(o => o.roomId === room.id).map(object => {
        const task = primaryObjectTask(tasks, object.id);
        const count = objectTasks(tasks, object.id).length;
        const needsAttention = objectTasks(tasks, object.id).some(taskNeedsAttention);
        const ownerIds = [...new Set(objectTasks(tasks, object.id).filter(t => t.status === 'assigned').map(t => t.to).filter(Boolean))];
        const ownerNames = ownerIds.map(id => people.find(person => person.id === id)?.name).filter(Boolean);
        return <button key={object.id} disabled={editing} aria-hidden={editing || undefined} tabIndex={editing ? -1 : undefined} className={`object-pin floating-marker ${task ? task.status : 'clear'} ${needsAttention ? 'needs-attention' : ''} ${object.x >= 65 ? 'owners-left' : ''}`} style={{ left: `${object.x}%`, top: `${object.y}%` }} data-object={object.id} data-hint-draggable={objectTasks(tasks, object.id).some(task => task.status === 'open') ? 'true' : undefined} aria-label={markerEditing ? `Move ${task?.title || objectName(object)}` : `${objectName(object)} in ${room.name}${task ? `, ${taskNeedsAttention(task) ? 'needs attention' : task.status}` : ', all good'}${ownerNames.length ? `, in charge: ${ownerNames.join(', ')}` : ''}`} aria-describedby={task?.status === 'open' && onTaskDrop ? 'task-drag-help' : undefined} title={task?.status === 'open' ? onTaskDrop ? `${task.title}: drag to a roommate to suggest, or tap for options` : task.title : undefined} onPointerDown={event => markerEditing ? startMarker(event, 'objects', object.id, { x: object.x, y: object.y }) : startObject(event, object)} onPointerMove={markerEditing ? moveMarker : undefined} onPointerUp={markerEditing ? endMarker : undefined} onPointerCancel={markerEditing ? endMarker : undefined} onLostPointerCapture={markerEditing ? endMarker : undefined} onKeyDown={event => markerKeys(event, 'objects', object.id, object)} onClick={e => { if (markerEditing) return; if (e.currentTarget.dataset.suppressClick && e.detail !== 0) { delete e.currentTarget.dataset.suppressClick; return; } onObject(object.id); }}>{task?.status === 'open' && onTaskDrop && <span className="pin-drag-grip"><Icon name="drag" size={13}/></span>}{markerEditing && <span className="marker-move-handle" aria-hidden="true"><Icon name="drag" size={12}/></span>}<Icon name={OBJECT_TYPES[object.type].icon} size={20}/>{task && (count > 1 || task.status !== 'open' || taskNeedsAttention(task)) && <span className="pin-badge">{count > 1 ? count : task.status === 'open' ? '!' : task.status === 'pending' ? '·' : '✓'}</span>}{(showTaskLabels || showObjectLabels || (object.name && object.name !== OBJECT_TYPES[object.type].label)) && <span className="room-task-label">{task?.title || objectName(object)}</span>}<ResponsibilityCharacters ids={ownerIds} people={people}/></button>;
      })}
      <div className="room-supply-layer" role="group" aria-label={`Supplies in ${room.name}`}>{inventory.filter(item => item.roomId === room.id).map(item => {
        const { x, y } = inventoryPosition(item, objects);
        const low = needsRestocking(item);
        return <button key={item.id} data-item={item.id} disabled={editing} aria-hidden={editing || undefined} tabIndex={editing ? -1 : undefined} className={`supply-map-pin inventory-marker ${low ? 'needs-stock' : ''} ${selectedItemId === item.id ? 'selected' : ''} ${x >= 65 ? 'owners-left' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} onPointerDown={markerEditing ? event => startMarker(event, 'items', item.id, { x, y }) : undefined} onPointerMove={markerEditing ? moveMarker : undefined} onPointerUp={markerEditing ? endMarker : undefined} onPointerCancel={markerEditing ? endMarker : undefined} onLostPointerCapture={markerEditing ? endMarker : undefined} onKeyDown={event => markerKeys(event, 'items', item.id, { x, y })} onClick={() => { if (!markerEditing) onItem?.(item.id, room.id); }} aria-label={markerEditing ? `Move ${item.name}` : `${item.name}, ${hasQuantity(item) ? quantityLabel(item) : STOCK_LEVELS[item.status]?.label}`}>
          {markerEditing && <span className="marker-move-handle" aria-hidden="true"><Icon name="drag" size={12}/></span>}<SupplyIcon item={item} size={24}/><span className="supply-map-count">{hasQuantity(item) ? item.quantity : '?'}</span>{(showTaskLabels || showObjectLabels) && <span className="supply-map-label">{item.name}</span>}
        </button>;
      })}</div>
      {editing && <button className="resize-handle" aria-label={`Resize ${room.name}`} title="Drag to resize; arrow keys change room size" onPointerDown={e => begin(e, room, true)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={e => {
        const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!delta) return;
        e.preventDefault(); e.stopPropagation(); onSelect(room.id);
        const next = { ...room, w: room.w + delta[0], h: room.h + delta[1] };
        if (canPlace(next, rooms, grid)) onMove(next);
        else onInvalid?.('That size overlaps another room or extends beyond the workspace.');
      }}><span aria-hidden="true"/></button>}
    </div>)}
    {editing && onResizeCanvas && <button type="button" className="canvas-resize-handle" aria-label="Resize canvas" title="Drag to resize canvas. Arrow keys resize one cell; Shift resizes four." onPointerDown={beginCanvasResize} onPointerMove={moveCanvasResize} onPointerUp={endCanvasResize} onPointerCancel={e => endCanvasResize(e, true)} onKeyDown={e => {
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!delta) return;
      e.preventDefault(); e.stopPropagation();
      const step = e.shiftKey ? 4 : 1;
      onResizeCanvas(constrainCanvas({ cols: grid.cols + delta[0] * step, rows: grid.rows + delta[1] * step }, rooms));
    }}><svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m5 15 10-10m-5 10 5-5m0 5h.01"/></svg></button>}
  </div>;
}
