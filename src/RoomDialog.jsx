import React, { useState } from 'react';
import Icon from './Icons';
import { roomPlacementDraft } from './model';
import { inventoryPosition } from './inventory';
import Modal from './Modal';
import AddActions from './AddActions';
import ApartmentMap from './ApartmentMap';

export default function RoomDialog({ state, roomId, onClose, onAdd, onAddTask, onObject, onItem, onCommitPlacement }) {
  const [draft, setDraft] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const room = state.rooms.find(r => r.id === roomId);
  if (!room) return <Modal title="Room unavailable" onClose={() => { if (draft) { setDraft(null); setDragging(false); setError(''); } else onClose(); }}><p>This room was removed.</p></Modal>;
  const items = state.inventory.filter(item => item.roomId === room.id);
  const objects = state.objects.filter(o => o.roomId === room.id);
  const shownItems = draft ? items.map(item => ({ ...item, ...(draft.items[item.id]?.point || {}) })) : items;
  const shownObjects = draft ? objects.map(object => ({ ...object, ...(draft.objects[object.id]?.point || {}) })) : objects;
  const hasTasks = state.tasks.some(task => task.status !== 'done' && objects.some(object => object.id === task.objectId));
  const mapWidth = Math.min(760, room.w * 72, 440 * room.w / room.h);
  return <Modal title={room.name} wide className="room-modal" style={{ '--room-modal-width': `${Math.max(340, mapWidth + 54)}px` }} onClose={() => { if (draft) { setDraft(null); setDragging(false); setError(''); } else onClose(); }}>
    <div className="room-detail">
      <div className="room-focus-map is-items-focused" style={{ '--room-aspect': room.w / room.h }}>
        <ApartmentMap rooms={[{ ...room, x: 0, y: 0 }]} grid={{ cols: room.w, rows: room.h }} objects={shownObjects} tasks={state.tasks} inventory={shownItems} markerEditing={Boolean(draft)} onMarkerDrag={setDragging} onMarkerMove={(kind, id, point) => setDraft(value => { const current = kind === 'objects' ? objects.find(object => object.id === id) : items.find(item => item.id === id); if (!value || !current) return value; const entry = value[kind][id] || { before: kind === 'objects' ? { x: current.x, y: current.y } : inventoryPosition(current, state.objects) }; return { ...value, [kind]: { ...value[kind], [id]: { ...entry, point } } }; })} people={state.people} onObject={onObject} onItem={onItem} showTaskLabels/>
        {!hasTasks && objects.length === 0 && items.length === 0 && <p className="room-empty-tasks">No tasks at the moment</p>}

      </div>
      <div className="room-map-actions room-placement-controls">
        {draft ? <div className="room-placement-actions"><button className="button subtle" onClick={() => { setDraft(null); setDragging(false); setError(''); }}>Cancel</button><button className="button primary" disabled={dragging} onClick={() => { if (onCommitPlacement(draft) === false) { setError('This room changed. Cancel and reopen Edit placement.'); return; } setDraft(null); setError(''); }}>Confirm<Icon name="check" size={15}/></button></div> : <><AddActions compact onTask={() => onAddTask(room.id)} onItem={() => onAdd(room.id)}/><button className="button subtle small-button room-edit-placement" disabled={!items.length && !objects.length} onClick={() => { setDraft(roomPlacementDraft(state, room.id)); setError(''); }}><Icon name="drag" size={15}/>Edit placement</button></>}
      </div>
      {error && <p className="room-placement-error" role="alert">{error}</p>}

    </div>
  </Modal>;
}
