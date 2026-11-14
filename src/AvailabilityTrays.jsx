import React, { useEffect, useId, useState } from 'react';
import Icon from './Icons';
import Avatar from './Avatar';
import { OBJECT_TYPES } from './model';
import { getAvailability, availabilityIsBusy, formatClock } from './availability';

const statuses = {
  'Home & free': { tone: 'free', icon: 'home' },
  'Leaving soon': { tone: 'leaving', icon: 'arrow' },
  Studying: { tone: 'studying', icon: 'book' },
  Away: { tone: 'away', icon: 'away' },
  Unknown: { tone: 'unknown', icon: 'question' },
};

export default function AvailabilityTrays({ people, currentUser, tasks, objects, draggingTask, onPerson, onTask, dockExpanded = true }) {
  const [pages, setPages] = useState({});
  const listPrefix = useId();
  useEffect(() => { if (!dockExpanded) setPages({}); }, [dockExpanded]);
  function taskIcon(task) {
    const object = objects.find(o => o.id === task.objectId);
    return OBJECT_TYPES[object?.type]?.icon || 'requests';
  }
  return <div className="availability-trays" aria-label="Roommate availability">
    {people.map(person => {
      const availability = getAvailability(person);
      const busy = availabilityIsBusy(availability.status);
      const status = busy ? 'Busy' : availability.label;
      const visual = statuses[availability.status] || statuses.Unknown;
      const assigned = tasks.filter(t => t.to === person.id && ['pending', 'assigned'].includes(t.status));
      const pageCount = Math.max(1, Math.ceil(assigned.length / 4));
      const page = Math.min(pages[person.id] || 0, pageCount - 1);
      const visibleTasks = assigned.slice(page * 4, page * 4 + 4);
      const listId = `${listPrefix}-${person.id}-tasks`;
      return <section key={person.id} className={`availability-tray tray-${visual.tone} source-${availability.source} ${busy ? 'is-unavailable' : ''}`} data-drop-disabled={busy ? 'true' : 'false'} data-person={person.id} data-person-name={person.name} data-self={person.id === currentUser} role="group" aria-label={`${person.name}, ${status}`}>
        <button className="tray-person" aria-label={`Availability: ${person.name}, ${status}`} title={`${person.name}: ${status}${availability.source === 'scheduled' ? ` · ${formatClock(availability.window.start)}–${formatClock(availability.window.end)}` : availability.source === 'usual' ? ' · Based on weekly routine' : availability.source === 'confirmed' ? ' · Temporary status' : ' · No current availability shared'}`} onClick={() => onPerson(person.id)}>
          <span className="tray-portrait"><Avatar person={person} className="tray-avatar"/><span className="tray-status"><Icon name={visual.icon} size={12}/></span></span>
          <span className="tray-name">{person.name}{person.id === currentUser && <span className="sr-only"> (you)</span>}<small className="tray-confidence"><Icon name={availability.source === 'confirmed' ? 'check' : availability.source === 'usual' ? 'repeat' : 'question'} size={10}/>{busy ? 'Busy' : availability.source === 'scheduled' ? `Until ${formatClock(availability.window.end)}` : availability.source === 'usual' ? 'Weekly' : availability.source === 'confirmed' ? 'Free' : 'Not set'}</small></span>
        </button>
        <div className={`tray-slot ${assigned.length > 4 ? 'has-task-pages' : ''}`}>
          {assigned.length === 0 && <span className="tray-placeholder" aria-hidden="true"><Icon name={busy ? 'clock' : 'plus'} size={17}/>{busy && <small>Busy</small>}</span>}
          {assigned.length > 4 && <button type="button" className="tray-page-arrow previous" aria-label={`Previous tasks for ${person.name}`} aria-controls={listId} disabled={page === 0} onClick={() => setPages(value => ({ ...value, [person.id]: page - 1 }))}><Icon name="chevron" size={13}/></button>}
          {assigned.length > 0 && <div id={listId} className="tray-task-list" role="group" aria-label={`Tasks for ${person.name}`}>{visibleTasks.map(task => <button key={task.id} className={`tray-task ${task.status}`} aria-label={`${task.title}, ${task.status === 'pending' ? 'pending' : 'accepted'} by ${person.name}`} title={`${task.title} · ${task.status === 'pending' ? 'Pending' : 'Accepted'}`} onClick={() => onTask(task.objectId, task.id)}><Icon name={taskIcon(task)} size={19}/><span className="tray-task-status"><Icon name={task.status === 'pending' ? 'clock' : 'check'} size={9}/></span></button>)}</div>}
          {assigned.length > 4 && <>
            <button type="button" className="tray-page-arrow" aria-label={`Next tasks for ${person.name}`} aria-controls={listId} disabled={page === pageCount - 1} onClick={() => setPages(value => ({ ...value, [person.id]: page + 1 }))}><Icon name="chevron" size={13}/></button>
            <span className="sr-only" role="status">Page {page + 1} of {pageCount} for {person.name}</span>
          </>}
          {draggingTask && !busy && <span className="tray-ghost" aria-hidden="true"><Icon name={taskIcon(draggingTask)} size={21}/></span>}
        </div>
      </section>;
    })}
  </div>;
}
