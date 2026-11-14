import React, { useState } from 'react';
import Icon from './Icons';
import Avatar from './Avatar';
import { ProfileSection } from './ProfilePage';
import AvailabilityWindowForm from './AvailabilityWindowForm';
import { RoutineWindows } from './AvailabilityDialog';
import { APARTMENT_TIME_ZONE, apartmentDate, availabilityIsBusy, availabilityText, canReceiveTask, dateDay, formatAvailabilityDate, formatMinute, getAvailability, scheduleSegments, effectiveScheduleSegments, shiftDate } from './availability';

export default function SchedulePage({ people, currentUser, onSaveRoutine }) {
  const today = apartmentDate();
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState(null);
  const [version, setVersion] = useState(0);
  const [sections, setSections] = useState({});
  const me = people.find(person => person.id === currentUser);
  const day = dateDay(date);
  const mine = (me.routine || []).filter(window => scheduleSegments([window], day, date).length);
  const toggle = id => setSections(value => ({ ...value, [id]: value[id] === false }));
  return <section className="schedule-page">
    <div className="schedule-date-toolbar"><div className="schedule-date-control"><button type="button" aria-label="Previous day" onClick={() => { setDate(shiftDate(date, -1)); setEditing(null); }}><Icon name="chevron" size={16}/></button><label><span className="sr-only">Schedule date</span><input aria-label="Schedule date" type="date" required value={date} onChange={event => { if (event.target.value) { setDate(event.target.value); setEditing(null); } }}/></label><button type="button" aria-label="Next day" onClick={() => { setDate(shiftDate(date, 1)); setEditing(null); }}><Icon name="chevron" size={16}/></button></div><button className="button subtle" onClick={() => { setDate(today); setEditing(null); }}>Today</button></div>
    <div className="schedule-section-grid">
      <ProfileSection id="schedule-self" title="Your availability" icon="clock" className="schedule-self-section" open={sections.self !== false} onToggle={() => toggle('self')}>
        <p className="schedule-selected-date">{formatAvailabilityDate(date)}</p>
        <AvailabilityWindowForm key={`${editing?.id || 'new'}-${date}-${version}`} window={editing} defaultDate={date} showDate={false} routine={me.routine || []} onCancel={editing ? () => setEditing(null) : undefined} onSave={window => { onSaveRoutine([...(me.routine || []).filter(existing => existing.id !== window.id), window]); setEditing(null); setVersion(value => value + 1); }}/>
        {mine.length > 0 && <div className="schedule-saved-windows"><h3>Saved times</h3><RoutineWindows routine={mine} onEdit={window => { if (window.date) setDate(window.date); setEditing(window); }} onDelete={id => { onSaveRoutine((me.routine || []).filter(window => window.id !== id)); if (editing?.id === id) setEditing(null); }}/></div>}
      </ProfileSection>
      <ProfileSection id="schedule-apartment" title="Apartment availability" icon="people" className="schedule-people-section household-section" open={sections.people !== false} onToggle={() => toggle('people')}>
        <p className="schedule-dock-explainer"><Icon name="people" size={15}/>Busy layers pause task drops. Unshared times stay open.</p>
        <div className="schedule-people-list">{people.map(person => {
          const current = getAvailability(person);
          const busy = availabilityIsBusy(current.status);
          const segments = effectiveScheduleSegments(person.routine || [], day, date);
          return <article className={`schedule-person-card ${busy ? 'is-busy' : ''}`} key={person.id} aria-label={`${person.name} availability`}>
            <div className="schedule-person-summary"><Avatar person={person} small/><div><strong>{person.name}{person.id === currentUser && <small>you</small>}</strong><span>{canReceiveTask(person) ? 'Task drops open now' : 'Task drops paused now'}</span></div><span className={`schedule-now-status ${busy ? 'is-busy' : current.status === 'Unknown' ? 'is-unknown' : 'is-free'}`}><Icon name={busy ? 'clock' : current.status === 'Unknown' ? 'question' : 'check'} size={12}/>{availabilityText(current.status)}</span></div>
            <div className="schedule-person-times">{segments.length ? segments.map(segment => <div key={segment.key} className={`schedule-time-window ${availabilityIsBusy(segment.status) ? 'is-busy' : 'is-free'}`}><span><Icon name={availabilityIsBusy(segment.status) ? 'clock' : 'check'} size={13}/>{availabilityText(segment.status)}</span><span>{formatMinute(segment.startMinute)} – {formatMinute(segment.endMinute)}</span></div>) : <p className="schedule-no-times">No times shared for this date</p>}</div>
          </article>;
        })}</div>
      </ProfileSection>
    </div>
    <p className="schedule-time-zone"><Icon name="clock" size={12}/>Apartment time · {APARTMENT_TIME_ZONE.replaceAll('_', ' ')}</p>
  </section>;
}
