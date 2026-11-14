import React, { useId, useState } from 'react';
import Modal from './Modal';
import Icon from './Icons';
import { OBJECT_TYPES, objectName, objectTasks } from './model';

export default function ObjectDialog({ state, id, taskId, me, act, onClose, onSuggest, onFlag, onUpdateTask, onRemove, onRemoveTask }) {
  const removeDescriptionId = useId();
  const object = state.objects.find(o => o.id === id);
  const tasks = objectTasks(state.tasks, id);
  const completed = state.tasks.filter(t => t.objectId === id && t.status === 'done');
  const [selectedId, setSelectedId] = useState(taskId || tasks[0]?.id);
  const task = tasks.find(t => t.id === selectedId) || tasks.at(-1);
  const unflagged = task?.status === 'open' && task.attention === false;
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (!object) return null;
  const detailed = Boolean(task && !unflagged);
  const assignedRestock = Boolean(task?.inventoryId && task.status === 'assigned' && task.to === me.id);
  const nameOf = personId => state.people.find(p => p.id === personId)?.name || (state.formerPeople || []).find(p => p.id === personId)?.name || 'A roommate';

  return <><Modal className={`object-modal ${detailed ? 'task-detail-modal' : ''}`} title={detailed ? task.title : objectName(object)} subtitle={state.rooms.find(r => r.id === object.roomId)?.name} onClose={onClose}>
      <div className="object-summary"><span className="object-summary-icon"><Icon name={OBJECT_TYPES[object.type].icon} size={26}/></span>{detailed ? <span className={`task-status status-${task.status}`}>{task.status === 'open' ? 'Needs a hand' : task.status === 'pending' ? 'Suggestion pending' : task.to === me.id ? 'Assigned to you' : `Assigned to ${nameOf(task.to)}`}</span> : <div>{object.notes && <p>{object.notes}</p>}</div>}</div>
      {tasks.length > 1 && <div className="object-task-list" role="group" aria-label="Tasks for this object">{tasks.map(t => <button key={t.id} className={`object-task-choice ${t.id === task.id ? 'selected' : ''}`} aria-pressed={t.id === task.id} onClick={() => { setSelectedId(t.id); }}><span className={`task-choice-dot ${t.status}`}/><span>{t.title}</span><Icon name={t.status === 'pending' ? 'clock' : t.status === 'assigned' ? 'check' : 'chevron'} size={14}/></button>)}</div>}
      {task && !unflagged && <section className="object-selected-task" aria-label="Selected task">
        <>
          {object.notes && object.notes !== task.notes && <p className="task-notes">{object.notes}</p>}
          {task.notes && <p className="task-notes">{task.notes}</p>}
          {task.status === 'pending' && <p className="object-detail-copy">{nameOf(task.from)} suggested this to {nameOf(task.to)}.</p>}
          <div className="stack-actions">
            {task.status === 'open' && task.attention !== false && <><button className="button primary" onClick={() => act(task, 'claim')}><Icon name="check" size={17}/>I’ll take this</button><button className="button subtle" onClick={() => onSuggest(task)}>Suggest to a roommate <Icon name="arrow" size={17}/></button></>}
            {task.status === 'pending' && task.to === me.id && <><button className="button primary" onClick={() => act(task, 'accept')}>Accept suggestion <Icon name="check" size={17}/></button><button className="button subtle" onClick={() => act(task, 'decline')}>Can’t this time</button></>}
            {task.status === 'pending' && task.from === me.id && <button className="button subtle" onClick={() => act(task, 'cancel')}>Withdraw suggestion</button>}
            {task.status === 'assigned' && task.to === me.id && <div className={assignedRestock ? 'restock-task-actions' : 'stack-actions'}><button className="button primary" onClick={() => { const applied = act(task, 'complete'); if (applied !== false && tasks.length === 1) onClose(); }}>Mark complete <Icon name="check" size={17}/></button>{assignedRestock && <button className="button subtle object-remove-button" onClick={() => setConfirmRemove(true)}><Icon name="trash" size={15}/>Remove</button>}</div>}
          </div>
        </>
      </section>}
      {(!task || unflagged) && <div className="add-object-task"><TaskForm key={unflagged ? `${task.id}-ready` : 'first'} task={unflagged ? task : undefined} defaultTitle={!task ? OBJECT_TYPES[object.type].task : ''} submitLabel="Flag for attention" onRemove={() => setConfirmRemove(true)} onSave={(title, notes) => {
        if (unflagged) { onUpdateTask({ ...task, title, notes }); act(task, 'flag'); }
        else onFlag(object, title, notes, true);
        setSelectedId(unflagged ? task.id : null);
      }}/></div>}
      {task?.status !== 'assigned' && completed.length > 0 && <details className="completed-object-tasks"><summary>Completed ({completed.length})</summary>{completed.map(t => <div key={t.id}><Icon name="check" size={14}/><span>{t.title}</span></div>)}</details>}
      {task && !unflagged && !assignedRestock && <div className="object-remove"><button className="button subtle object-remove-button" onClick={() => setConfirmRemove(true)}><Icon name="trash" size={15}/>Remove</button></div>}
  </Modal>
    {confirmRemove && <Modal title={task?.inventoryId ? 'Remove restock task?' : 'Remove object?'} role="alertdialog" descriptionId={removeDescriptionId} className="remove-confirmation" onClose={() => setConfirmRemove(false)}>
      <span className="remove-confirmation-icon"><Icon name="trash" size={25}/></span>
      <p id={removeDescriptionId}>{task?.inventoryId ? <>Remove <strong>{task.title}</strong>? The item and its quantity will stay.</> : <>Remove <strong>{objectName(object)}</strong> from the apartment?{tasks.length + completed.length > 0 && ' Its tasks will also be removed.'}</>}</p>
      <div className="remove-confirmation-actions"><button className="button subtle" data-initial-focus onClick={() => setConfirmRemove(false)}>Cancel</button><button className="button remove-confirmation-submit" onClick={() => task?.inventoryId ? onRemoveTask(task.id) : onRemove(id)}><Icon name="trash" size={15}/>Remove</button></div>
    </Modal>}
  </>;
}

function TaskForm({ task, defaultTitle = '', submitLabel = 'Save task', onCancel, onSave, onRemove }) {
  const [title, setTitle] = useState(task?.title || defaultTitle);
  const [notes, setNotes] = useState(task?.notes || '');
  return <form onSubmit={e => { e.preventDefault(); if (title.trim()) onSave(title.trim(), notes.trim()); }}>
    <label className="field-label" htmlFor="task-title">What needs doing?</label><input id="task-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} required/>
    <label className="field-label" htmlFor="task-notes">Task notes (optional)</label><textarea id="task-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={2}/>
    <div className="task-form-actions">{onCancel && <button type="button" className="button subtle" onClick={onCancel}>Cancel</button>}<button className="button primary" disabled={!title.trim()}>{submitLabel}<Icon name={submitLabel === 'Flag for attention' ? 'plus' : task ? 'check' : 'plus'} size={16}/></button>{onRemove && <button type="button" className="button subtle object-remove-button" onClick={onRemove}><Icon name="trash" size={15}/>Remove</button>}</div>
  </form>;
}
