import React from 'react';
import Modal from './Modal';
import Icon from './Icons';
import AvailabilityWindowForm from './AvailabilityWindowForm';
import { APARTMENT_TIME_ZONE, apartmentDate, availabilityText, formatAvailabilityDate, formatClock, DAYS } from './availability';

export function RoutineWindows({ routine = [], onEdit, onDelete }) {
  return <div className="routine-list">{routine.map(window => <div className="routine-window" key={window.id}>
    <span className="routine-window-icon"><Icon name={availabilityText(window.status) === 'Busy' ? 'clock' : 'check'} size={18}/></span>
    <div className="routine-window-copy"><strong>{availabilityText(window.status)}</strong><span>{window.date ? formatAvailabilityDate(window.date) : [1, 2, 3, 4, 5, 6, 0].filter(day => window.days?.includes(day)).map(day => DAYS[day]).join(', ')}</span><span>{formatClock(window.start)} – {formatClock(window.end)}{window.end < window.start ? ' · next day' : ''}</span></div>
    {onEdit && <div className="routine-window-actions"><button type="button" className="icon-button" aria-label={`Edit ${availabilityText(window.status)} availability`} onClick={() => onEdit(window)}><Icon name="edit" size={14}/></button><button type="button" className="icon-button" aria-label={`Remove ${availabilityText(window.status)} availability`} onClick={() => onDelete(window.id)}><Icon name="trash" size={14}/></button></div>}
  </div>)}</div>;
}

export default function AvailabilityDialog({ me, onClose, onSaveRoutine }) {
  return <Modal title="Set availability" className="availability-editor-modal" onClose={onClose}>
    <AvailabilityWindowForm defaultDate={apartmentDate()} routine={me.routine || []} onSave={window => { onSaveRoutine([...(me.routine || []), window]); onClose(); }}/>
    <p className="schedule-time-zone"><Icon name="clock" size={12}/>{APARTMENT_TIME_ZONE.replaceAll('_', ' ')}</p>
  </Modal>;
}
