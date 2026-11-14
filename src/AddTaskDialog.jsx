import React, { useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icons';
import SelectMenu from './SelectMenu';
import ApartmentMap from './ApartmentMap';
import { OBJECT_TYPES, ROOM_TYPES, objectPosition } from './model';

export default function AddTaskDialog({ rooms, objects = [], inventory = [], tasks = [], people = [], defaultRoomId, onClose, onAdd, onEdit }) {
  const [name, setName] = useState(OBJECT_TYPES.trash.task);
  const [type, setType] = useState('trash');
  const [roomId, setRoomId] = useState(defaultRoomId || rooms[0]?.id || '');
  const [placing, setPlacing] = useState(false);
  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const board = useRef(null);
  const gesture = useRef(null);
  const room = rooms.find(r => r.id === roomId);
  const occupied = objects.filter(o => o.roomId === roomId);
  function startPlacement(event) {
    event.preventDefault();
    if (!name.trim() || !room) return;
    setPosition(objectPosition(occupied, roomId));
    setPlacing(true);
  }
  function move(event) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    const rect = board.current.getBoundingClientRect();
    const point = { x: Math.max(10, Math.min(90, (event.clientX - rect.left) / rect.width * 100 - drag.dx)), y: Math.max(18, Math.min(88, (event.clientY - rect.top) / rect.height * 100 - drag.dy)) };
    drag.point = point;
    setPosition(point);
  }
  function end(event) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    setPosition(event.type === 'pointercancel' ? drag.before : objectPosition(occupied, roomId, drag.point) || drag.before);
    gesture.current = null;
    setDragging(false);
  }
  return <Modal title={placing ? 'Place task' : 'Add task'} className={`add-object-modal ${placing ? 'object-placement-modal' : ''}`} onClose={onClose} footer={placing && room ? <div className="object-placement-actions"><button type="button" className="button subtle" onClick={() => setPlacing(false)}>Back</button><button type="button" className="button primary" disabled={!position || dragging} onClick={() => onAdd({ type, name: name.trim(), roomId, ...position }, name.trim())}>Confirm<Icon name="check" size={16}/></button></div> : undefined}>
    {placing && room ? <>
      <p className="object-placement-hint"><Icon name="drag" size={15}/>Drag {name.trim()} into place</p>
      <div className="object-placement-board room-focus-map is-items-focused" ref={board} style={{ '--room-aspect': room.w / room.h }}>
        <div className="object-placement-preview" inert aria-hidden="true"><ApartmentMap rooms={[{ ...room, x: 0, y: 0 }]} grid={{ cols: room.w, rows: room.h }} objects={occupied} inventory={inventory.filter(item => item.roomId === roomId)} tasks={tasks} people={people}/></div>
        <div className="object-placement-layer">{position && <button type="button" className={`object-pin floating-marker open placement-marker ${dragging ? 'is-dragging' : ''}`} aria-label={`Position ${name.trim()}`} aria-describedby="object-placement-keyboard" style={{ left: `${position.x}%`, top: `${position.y}%` }}
          onPointerDown={event => {
            if (event.button !== 0 || gesture.current) return;
            event.preventDefault();
            event.currentTarget.focus();
            const rect = board.current.getBoundingClientRect();
            gesture.current = { id: event.pointerId, before: position, point: position, dx: (event.clientX - rect.left) / rect.width * 100 - position.x, dy: (event.clientY - rect.top) / rect.height * 100 - position.y };
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={event => { if (gesture.current) end({ ...event, type: 'pointercancel', pointerId: event.pointerId }); }}
          onKeyDown={event => {
            const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
            if (!direction) return;
            event.preventDefault();
            const step = event.shiftKey ? 8 : 2;
            const point = { x: Math.max(10, Math.min(90, position.x + direction[0] * step)), y: Math.max(18, Math.min(88, position.y + direction[1] * step)) };
            if (!occupied.some(o => Math.hypot(o.x - point.x, o.y - point.y) < 24)) setPosition(point);
          }}><Icon name={OBJECT_TYPES[type].icon} size={24}/></button>}</div>
      </div>
      <span id="object-placement-keyboard" className="sr-only">Drag to position. Use arrow keys for small adjustments, or Shift and arrow keys for larger adjustments.</span>
      {!position && <p role="alert" className="object-placement-hint">This room is full. Go back and choose another room.</p>}
    </> : rooms.length ? <form onSubmit={startPlacement}>
      <label className="field-label" htmlFor="new-object-name">Task name</label><input id="new-object-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} required/>
      <label className="field-label">Icon</label><div className="object-palette">{Object.entries(OBJECT_TYPES).map(([key, info]) => <button key={key} type="button" className={type === key ? 'selected' : ''} aria-pressed={type === key} onClick={() => { setType(key); if (name === OBJECT_TYPES[type].task) setName(info.task); }}><Icon name={info.icon} size={23}/>{info.label}</button>)}</div>
      <label className="field-label" htmlFor="object-room">Room</label><SelectMenu id="object-room" value={roomId} onChange={setRoomId} options={rooms.map(r => ({ value: r.id, label: r.name, icon: ROOM_TYPES[r.type]?.icon }))}/>
      <button className="button primary full-width" disabled={!name.trim() || !room} type="submit">Add to apartment<Icon name="plus" size={17}/></button>
    </form> : <div className="large-empty"><p>Add a room before placing tasks.</p><button className="button primary" onClick={onEdit}>Add a room</button></div>}
  </Modal>;
}
