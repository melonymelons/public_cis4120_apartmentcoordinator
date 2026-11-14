import React, { useState } from 'react';
import Icon from './Icons';
import { createId } from './model';
import { apartmentClock, apartmentDate, availabilityIsBusy, dateDay, DAYS, routineError } from './availability';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export default function AvailabilityWindowForm({ window, defaultDate = apartmentDate(), routine = [], showDate = true, onSave, onCancel }) {
  const now = apartmentClock();
  const startMinute = Math.floor(now.minute / 15) * 15;
  const time = value => `${String(Math.floor(value % 1440 / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const [date, setDate] = useState(window?.date || defaultDate);
  const [repeat, setRepeat] = useState(Boolean(window && !window.date));
  const [days, setDays] = useState(window?.days || [dateDay(defaultDate)]);
  const [start, setStart] = useState(window?.start || time(startMinute));
  const [end, setEnd] = useState(window?.end || time(startMinute + 120));
  const [busy, setBusy] = useState(availabilityIsBusy(window?.status));
  const [error, setError] = useState('');
  return <form className="availability-window-form" onChange={() => setError('')} onSubmit={event => {
    event.preventDefault();
    const draft = { id: window?.id || createId(), days: repeat ? days : [dateDay(date)], start, end, status: busy ? 'Studying' : 'Home & free', ...(repeat ? {} : { date }) };
    const message = routineError(draft, routine);
    if (message) { setError(message); return; }
    onSave(draft);
  }}>
    <div className="availability-choice" role="group" aria-label="Availability"><button type="button" className={!busy ? 'selected is-free' : ''} aria-pressed={!busy} onClick={() => { setBusy(false); setError(''); }}><Icon name="check" size={17}/>Free</button><button type="button" className={busy ? 'selected is-busy' : ''} aria-pressed={busy} onClick={() => { setBusy(true); setError(''); }}><Icon name="clock" size={17}/>Busy</button></div>
    {showDate && !repeat && <label className="availability-date-field">Date<input aria-label="Availability date" type="date" required value={date} onChange={event => setDate(event.target.value)}/></label>}
    <div className="availability-time-inputs"><label>From<input aria-label="Start time" type="time" step="60" required value={start} onChange={event => setStart(event.target.value)}/></label><label>Until<input aria-label="End time" type="time" step="60" required value={end} onChange={event => setEnd(event.target.value)}/></label></div>
    {end < start && <p className="availability-overnight">Ends the next day.</p>}
    <button type="button" className="availability-repeat-toggle" aria-pressed={repeat} onClick={() => { setRepeat(!repeat); setError(''); }}><Icon name="repeat" size={15}/>Repeat weekly<span className={`availability-repeat-switch ${repeat ? 'is-on' : ''}`} aria-hidden="true"/></button>
    {repeat && <fieldset className="availability-repeat-days"><legend>Repeat on</legend><div>{[1, 2, 3, 4, 5, 6, 0].map(day => <button type="button" key={day} aria-label={dayNames[day]} aria-pressed={days.includes(day)} onClick={() => { setDays(days.includes(day) ? days.filter(value => value !== day) : [...days, day]); setError(''); }}>{DAYS[day]}</button>)}</div></fieldset>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="availability-window-actions">{onCancel && <button type="button" className="button subtle" onClick={onCancel}>Cancel</button>}<button className="button primary" type="submit"><Icon name="check" size={15}/>Save availability</button></div>
  </form>;
}
