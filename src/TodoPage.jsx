import React, { useEffect, useState } from 'react';
import Icon from './Icons';
import Avatar from './Avatar';
import SelectMenu from './SelectMenu';
import { ProfileSection } from './ProfilePage';
import { OBJECT_TYPES, ROOM_TYPES, objectName } from './model';

export default function TodoPage({ state, filter, onFilter, onOpen, onAct, onSuggest, onAddTask }) {
  const [query, setQuery] = useState('');
  const [roomId, setRoomId] = useState('all');
  const [sections, setSections] = useState({});
  const mine = task => task.to === state.currentUser;
  const counts = {
    active: state.tasks.filter(t => t.status !== 'done').length,
    mine: state.tasks.filter(t => t.status !== 'done' && mine(t)).length,
    done: state.tasks.filter(t => t.status === 'done').length,
  };
  useEffect(() => { if (roomId !== 'all' && !state.rooms.some(r => r.id === roomId)) setRoomId('all'); }, [state.rooms, roomId]);
  const person = id => state.people.find(p => p.id === id) || (state.formerPeople || []).find(p => p.id === id);
  const name = id => person(id)?.name || 'A roommate';
  const clear = () => { setQuery(''); setRoomId('all'); };
  const add = () => onAddTask(() => { clear(); onFilter('active'); setSections(value => ({ ...value, open: true })); });
  const tasks = state.tasks.filter(task => {
    const object = state.objects.find(o => o.id === task.objectId);
    const room = state.rooms.find(r => r.id === object?.roomId);
    return (filter === 'done' ? task.status === 'done' : task.status !== 'done' && (filter !== 'mine' || mine(task)))
      && (roomId === 'all' || room?.id === roomId)
      && `${task.title} ${task.notes || ''} ${objectName(object)} ${room?.name || ''} ${task.to ? name(task.to) : ''}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const groups = filter === 'done' ? [['completed', 'Completed', 'check', () => true]] : [
    ['reply', 'Needs your reply', 'bell', t => t.status === 'pending' && mine(t)],
    ['yours', 'Your tasks', 'user', t => t.status === 'assigned' && mine(t)],
    ['open', 'Up for grabs', 'sparkles', t => t.status === 'open'],
    ['waiting', 'Waiting on a roommate', 'clock', t => t.status === 'pending' && !mine(t)],
    ['others', 'Roommates’ tasks', 'people', t => t.status === 'assigned' && !mine(t)],
  ];
  return <section className="list-page todos-page">
    <div className="todo-global-tools">
      <div className="todo-page-toolbar"><p>{counts.active} active <span aria-hidden="true">·</span> {counts.mine} for you</p><button className="button primary" onClick={add}><Icon name="plus" size={15}/>Add task</button></div>
      <div className="todo-tools"><div className="todo-search"><Icon name="search" size={17}/><input type="search" aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button type="button" aria-label="Clear task search" onClick={() => setQuery('')}><Icon name="close" size={13}/></button>}</div><label className="sr-only" htmlFor="todo-room-filter">Filter tasks by room</label><SelectMenu id="todo-room-filter" value={roomId} onChange={setRoomId} options={[{ value: 'all', label: 'All rooms', icon: 'home' }, ...state.rooms.map(room => ({ value: room.id, label: room.name, icon: ROOM_TYPES[room.type]?.icon }))]}/></div>
      <div className="todo-filter-tabs" role="group" aria-label="Filter responsibilities">{[['active', 'Active'], ['mine', 'For me'], ['done', 'Completed']].map(([key, label]) => <button key={key} className={filter === key ? 'selected' : ''} aria-pressed={filter === key} onClick={() => onFilter(key)}>{label}<span aria-hidden="true">{counts[key]}</span></button>)}</div>
    </div>
    <div className="todo-group-list">
    {groups.map(([key, title, icon, matches]) => {
      const items = tasks.filter(matches);
      return items.length > 0 && <ProfileSection key={key} id={`todo-${key}`} title={title} icon={icon} count={items.length} className={`todo-group todo-group-${key} ${['yours', 'others', 'completed'].includes(key) ? 'household-section' : key === 'open' ? 'todo-section-sand' : ''}`} open={sections[key] !== false} onToggle={() => setSections(value => ({ ...value, [key]: value[key] === false }))}>
        <div className="todo-card-list">{items.map(task => {
          const object = state.objects.find(o => o.id === task.objectId);
          const room = state.rooms.find(r => r.id === object?.roomId);
          const owner = person(task.status === 'pending' && mine(task) ? task.from : task.to);
          const status = task.status === 'open' ? 'Anyone can pick this up' : task.status === 'pending' ? (mine(task) ? `${name(task.from)} suggested this` : `Suggested to ${name(task.to)}`) : task.status === 'assigned' ? `${name(task.to)} is on it` : `Completed by ${name(task.to)}`;
          return <article className={`todo-row todo-${task.status}`} key={task.id} aria-label={task.title}>
            <button className="task-card todo-detail" onClick={() => onOpen(task)}><span className={`task-icon ${task.status} ${task.attention === false ? 'unflagged' : ''}`}><Icon name={OBJECT_TYPES[object?.type]?.icon || 'check'}/></span><span className="task-copy"><strong>{task.title}</strong><span className="todo-room-label"><Icon name="map" size={12}/>{room?.name || 'Apartment'}{task.inventoryId && <small>Restock</small>}</span><span className="todo-owner">{owner && <Avatar person={owner} small/>}{status}</span></span><Icon name="chevron" size={15}/></button>
            <div className="todo-actions">
              {task.status === 'open' && <><button className="button primary" aria-label={`Take task: ${task.title}`} onClick={() => onAct(task, 'claim')}><Icon name="plus" size={14}/>I’ll take this</button>{state.people.length > 1 && <button className="button subtle" aria-label={`Suggest task: ${task.title}`} onClick={() => onSuggest(task)}>Suggest<Icon name="arrow" size={13}/></button>}</>}
              {task.status === 'pending' && mine(task) && <><button className="button primary" aria-label={`Accept task: ${task.title}`} onClick={() => onAct(task, 'accept')}><Icon name="check" size={14}/>Accept</button><button className="button subtle" aria-label={`Decline task: ${task.title}`} onClick={() => onAct(task, 'decline')}>Not now</button></>}
              {task.status === 'pending' && !mine(task) && task.from === state.currentUser && <button className="button subtle" aria-label={`Withdraw task: ${task.title}`} onClick={() => onAct(task, 'cancel')}>Withdraw</button>}
              {task.status === 'assigned' && mine(task) && <button className="button subtle todo-complete-action" aria-label={`Complete task: ${task.title}`} onClick={() => onAct(task, 'complete')}><Icon name="check" size={14}/>Mark complete</button>}
            </div>
          </article>;
        })}</div>
      </ProfileSection>;
    })}
    </div>
    {!tasks.length && <div className="large-empty todo-empty"><Icon name={filter === 'done' ? 'check' : 'sparkles'} size={32}/><h3>{query.trim() || roomId !== 'all' ? 'No matching tasks' : filter === 'done' ? 'No completed tasks' : filter === 'mine' ? 'No tasks assigned to you' : 'No active tasks'}</h3><p>{query.trim() || roomId !== 'all' ? 'Try another search or room.' : filter === 'done' ? 'Completed responsibilities will appear here.' : filter === 'mine' ? 'Pick up an open task or accept a suggestion.' : 'Everything is taken care of.'}</p>{(query.trim() || roomId !== 'all' || filter !== 'active') && <button className="button subtle" onClick={query.trim() || roomId !== 'all' ? clear : () => { clear(); onFilter('active'); }}>{query.trim() || roomId !== 'all' ? 'Clear filters' : 'See active tasks'}</button>}</div>}
  </section>;
}
