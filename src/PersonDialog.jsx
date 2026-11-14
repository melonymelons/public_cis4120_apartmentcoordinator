import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Avatar from './Avatar';
import Icon from './Icons';
import SelectMenu from './SelectMenu';
import { objectName } from './model';
import { RoutineWindows } from './AvailabilityDialog';
import { APARTMENT_TIME_ZONE, getAvailability, formatClock, formatExpiry } from './availability';

export default function PersonDialog({ person, tasks, rooms = [], objects = [], currentUser, onClose, onSuggest }) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const [roomId, setRoomId] = useState('all');
  const search = useRef(null), viewAll = useRef(null), visited = useRef(false);
  useEffect(() => {
    if (showAll) { search.current?.focus({ preventScroll: true }); visited.current = true; }
    else if (visited.current) viewAll.current?.focus({ preventScroll: true });
  }, [showAll]);
  useEffect(() => { if (roomId !== 'all' && !rooms.some(room => room.id === roomId)) setRoomId('all'); }, [rooms, roomId]);
  if (!person) return <Modal title="Roommate unavailable" className="person-modal" onClose={onClose}><p className="person-status-source">This person is no longer in your apartment.</p></Modal>;
  const availability = getAvailability(person);
  const source = availability.source === 'scheduled' ? `Scheduled · ${formatClock(availability.window.start)}–${formatClock(availability.window.end)}` : availability.source === 'confirmed' ? `Confirmed until ${formatExpiry(availability.expires)}` : availability.source === 'usual' ? 'Based on their weekly routine' : 'No current availability shared';
  const roomFor = task => rooms.find(room => room.id === objects.find(object => object.id === task.objectId)?.roomId);
  const filtered = tasks.filter(task => {
    const object = objects.find(object => object.id === task.objectId);
    const room = roomFor(task);
    return (roomId === 'all' || room?.id === roomId) && `${task.title} ${task.notes || ''} ${objectName(object)} ${room?.name || ''}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const taskChoice = task => <button key={task.id} className="person-task-choice" onClick={() => onSuggest(task, person.id)}><span><strong>{task.title}</strong><small>{roomFor(task)?.name || 'Apartment'}</small></span><Icon name="arrow" size={16}/></button>;
  return <Modal title={showAll ? 'Suggest a task' : `${person.name}’s availability`} className={`person-modal ${showAll ? 'person-task-browser' : ''}`} onClose={onClose}>
    {showAll ? <>
      <button className="button subtle small-button person-tasks-back" onClick={() => setShowAll(false)}><Icon name="arrow" size={14}/>Back</button>
      <div className="person-task-tools"><label className="inventory-search"><Icon name="search" size={16}/><input ref={search} type="search" aria-label="Search tasks" placeholder="Search…" value={query} onChange={event => setQuery(event.target.value)}/></label><div><label htmlFor="person-task-room" className="sr-only">Filter tasks by room</label><SelectMenu id="person-task-room" value={roomId} onChange={setRoomId} options={[{ value: 'all', label: 'All rooms' }, ...rooms.map(room => ({ value: room.id, label: room.name }))]}/></div></div>
      <p className="person-task-results" role="status">{filtered.length} {filtered.length === 1 ? 'task' : 'tasks'}</p>
      {filtered.length ? <div className="person-task-list person-task-results-list" role="group" aria-label="Tasks to suggest">{filtered.map(taskChoice)}</div> : <div className="person-task-empty"><Icon name="search" size={24}/><p>{tasks.length ? 'No matching tasks' : 'No open tasks'}</p>{(query.trim() || roomId !== 'all') && <button className="button subtle small-button" onClick={() => { setQuery(''); setRoomId('all'); search.current?.focus(); }}>Clear filters</button>}</div>}
    </> : <>
      <div className="person-overview"><Avatar person={person}/><div><strong>{availability.label}</strong><p className="person-status-source">{source}</p></div></div>
      {person.routine?.length > 0 && <section className="person-section" aria-label="Shared availability"><h3>Shared availability</h3><div className="person-routine-list"><RoutineWindows routine={person.routine}/></div><p className="person-time-zone">Apartment time · {APARTMENT_TIME_ZONE}</p></section>}
      {person.id !== currentUser && tasks.length > 0 && <section className="person-section person-task-preview" aria-label="Suggest a task"><h3>Suggest a task</h3><div className="person-task-list">{tasks.slice(0, 3).map(taskChoice)}</div>{tasks.length > 3 && <button ref={viewAll} className="button subtle person-view-all" onClick={() => setShowAll(true)}>View all tasks<span aria-hidden="true">{tasks.length}</span><Icon name="arrow" size={14}/></button>}</section>}
    </>}
  </Modal>;
}
