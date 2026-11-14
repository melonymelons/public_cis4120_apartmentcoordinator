import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ApartmentMap from './ApartmentMap';
import MapViewport from './MapViewport';
import Modal from './Modal';
import AddActions from './AddActions';
import Icon, { Furniture } from './Icons';
import { ROOM_TYPES, createId, objectPosition } from './model';
import { addRoomToDraft, layoutDraft } from './layout';

export default function ApartmentWorkspace({ state, addingRoom, onAddRoom, onCloseAddRoom, onCommit, onAddTask, onAddItem, onObject, onItem, onRoom, onTaskDrag, onDragAnnouncement, onTaskDrop, onTaskDropRejected }) {
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [newRoomId, setNewRoomId] = useState(null);
  const [headerActions, setHeaderActions] = useState(null);
  const [itemsFocused, setItemsFocused] = useState(false);
  useLayoutEffect(() => { setHeaderActions(document.getElementById('apartment-header-actions')); }, []);
  const selectedRoom = draft?.rooms.find(room => room.id === selected);
  const removedObjects = draft ? state.objects.filter(object => !draft.rooms.some(room => room.id === object.roomId)).length : 0;
  useEffect(() => {
    if (!draft) return;
    const escape = event => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { setDraft(null); setSelected(null); setError(''); }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [Boolean(draft)]);
  function cancel() { setDraft(null); setSelected(null); setNewRoomId(null); setError(''); }
  function add(type) {
    const next = addRoomToDraft(draft || layoutDraft(state), type, createId());
    if (!next) return;
    setDraft(next); setSelected(next.rooms.at(-1).id); setNewRoomId(next.rooms.at(-1).id); setError(''); onCloseAddRoom();
  }
  const actions = draft ? <>
    <button className="button subtle small-button" onClick={cancel}>Cancel</button>
    <button className="button primary small-button" disabled={draft.rooms.some(room => !room.name.trim())} onClick={() => {
      if (JSON.stringify(state.rooms) !== draft.baseRooms || JSON.stringify(state.canvas) !== draft.baseCanvas) { setError('The layout changed on another device. Cancel and reopen Edit to use the latest layout.'); return; }
      if (onCommit(draft) !== false) cancel();
    }}><Icon name="check" size={15}/>Done</button>
  </> : <>
    <button type="button" className="item-focus-toggle" role="switch" aria-label="Focus items" title="Focus items" aria-checked={itemsFocused} onClick={() => setItemsFocused(value => !value)}><span className="item-focus-track" aria-hidden="true"><span className="item-focus-thumb"><Icon name="eye" size={14}/></span></span></button>
    <button className="button subtle small-button" onClick={() => { setDraft(layoutDraft(state)); setSelected(null); setError(''); }} aria-label="Edit apartment"><Icon name="edit" size={15}/><span>Edit</span></button>
  </>;
  return <section className={`apartment-card ${draft ? 'is-rearranging' : ''} ${itemsFocused && !draft ? 'is-items-focused' : ''}`}>
    {headerActions ? createPortal(actions, headerActions) : <div className="map-actions">{actions}</div>}
    <div className="card-heading"><div className={`map-actions ${draft ? 'map-add-panel' : ''}`} role={draft ? 'group' : undefined} aria-label={draft ? 'Add to apartment' : undefined}>
      {draft && <>
        <AddActions compact onTask={() => onAddTask(draft.rooms, (object, firstTask) => {
          const position = objectPosition([...state.objects, ...(draft.addedObjects || [])], object.roomId, object);
          if (!position) return false;
          const id = createId();
          setDraft(value => ({ ...value, addedObjects: [...(value.addedObjects || []), { ...object, ...position, id }], addedTasks: firstTask ? [...(value.addedTasks || []), { id: createId(), objectId: id, title: firstTask, attention: false, status: 'open', from: state.currentUser, to: null }] : value.addedTasks }));
          return true;
        }, [...state.objects, ...(draft.addedObjects || [])], [...state.inventory, ...(draft.addedInventory || [])], [...state.tasks, ...(draft.addedTasks || [])])} onItem={() => onAddItem(draft.rooms, item => {
          setDraft(value => ({ ...value, addedInventory: [...(value.addedInventory || []), item] }));
        }, [...state.objects, ...(draft.addedObjects || [])], [...state.inventory, ...(draft.addedInventory || [])])}/>
        <button className="button subtle small-button" onClick={onAddRoom}><Icon name="plus" size={15}/><span>Add room</span></button>
      </>}
    </div></div>
    <span className="sr-only" id="task-drag-help">Drag a yellow or pink task into a roommate’s tray to suggest it, or tap the task for options.</span>
    <MapViewport rooms={draft?.rooms || state.rooms} grid={draft?.canvas || state.canvas} rearranging={Boolean(draft)} revealRoomId={newRoomId}>
      <ApartmentMap rooms={draft?.rooms || state.rooms} grid={draft?.canvas || state.canvas} editing={Boolean(draft)} selected={selected} showObjectLabels={itemsFocused && !draft}
        onSelect={setSelected} onMove={next => { setDraft(value => ({ ...value, rooms: value.rooms.map(room => room.id === next.id ? next : room) })); setError(''); }}
        onRemove={id => { setDraft(value => ({ ...value, rooms: value.rooms.filter(room => room.id !== id) })); if (selected === id) setSelected(null); setError(''); }}
        onInvalid={setError} inventory={[...state.inventory, ...(draft?.addedInventory || [])]} people={state.people} objects={[...state.objects, ...(draft?.addedObjects || [])]} tasks={[...state.tasks, ...(draft?.addedTasks || [])]}
        onObject={onObject} onItem={onItem} onRoom={onRoom} onTaskDrag={onTaskDrag} onDragAnnouncement={onDragAnnouncement} onTaskDrop={onTaskDrop} onTaskDropRejected={onTaskDropRejected}/>
    </MapViewport>
    {draft && <div className="room-edit-toolbar" onPointerDown={event => event.stopPropagation()}>
      {selectedRoom ? <label><span className="sr-only">Room name</span><Icon name="edit" size={14}/><input aria-label="Room name" value={selectedRoom.name} maxLength={32} onChange={event => {
        const name = event.target.value;
        setDraft(value => ({ ...value, rooms: value.rooms.map(room => room.id === selected ? { ...room, name } : room) }));
      }}/></label> : <span className="room-edit-hint"><Icon name="move" size={14}/>Drag rooms · Resize corners</span>}
      {removedObjects > 0 && <p className="layout-delete-note">Done will remove {removedObjects} {removedObjects === 1 ? 'object' : 'objects'} and their tasks from deleted rooms.</p>}
      {error && <p className="layout-error" role="alert">{error}</p>}
    </div>}
    {!draft && <div className="map-legend"><span><i className="legend-dot attention"/>Needs a hand</span><span><i className="legend-dot assigned"/>Taken care of</span></div>}
    {addingRoom && <Modal title="Add room" onClose={onCloseAddRoom}>
      <div className="add-room-choices">{Object.entries(ROOM_TYPES).map(([type, info]) => <button key={type} className="add-room-choice" onClick={() => add(type)} aria-label={`Add ${info.label}`}>
        <span className="add-room-preview"><Furniture type={type}/></span><span className="add-room-caption"><Icon name={info.icon} size={17}/>{info.label}<Icon name="plus" size={14}/></span>
      </button>)}</div>
    </Modal>}
  </section>;
}
