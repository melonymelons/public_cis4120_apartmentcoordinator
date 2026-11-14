import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Icon from './Icons';
import Avatar from './Avatar';
import { installButtonFeedback, taskFeedback } from './motion';
import Modal from './Modal';
import Toast from './Toast';
import AddTaskDialog from './AddTaskDialog';
import ObjectDialog from './ObjectDialog';
import ApartmentWorkspace from './ApartmentWorkspace';
import { commitLayout } from './layout';
import RoomDialog from './RoomDialog';
import ItemDetailDialog from './ItemDetailDialog';
import RestockCompleteDialog from './RestockCompleteDialog';
import InviteDialog from './InviteDialog';
import CloudShell from './cloud/CloudShell';
import HelloPage from './HelloPage';
import Brand from './Brand';
import AvailabilityDock from './AvailabilityDock';
import DockDragHint from './DockDragHint';
import InventoryPage, { InventoryItemDialog } from './InventoryPage';
import ProfilePage, { HouseholdDialog } from './ProfilePage';
import PersonDialog from './PersonDialog';
import TodoPage from './TodoPage';
import { updateOwnProfile, createHousehold } from './household';
import SchedulePage from './SchedulePage';
import { updateInventoryItem, adjustQuantity, inventoryPosition, nearbyRestockPosition } from './inventory';
import AvailabilityDialog from './AvailabilityDialog';
import { availabilityLabel, canReceiveTask } from './availability';
import { transitionTask, applyTaskAction, removeRestockTask, commitRoomPlacement, loadDemoState, createId, objectPosition, objectName, objectTasks } from './model';
import './style.css';
import './premium.css';
import './pixel.css';

const uid = createId;
const personName = (state, id) => state.people.find(p => p.id === id)?.name || (state.formerPeople || []).find(p => p.id === id)?.name || 'A roommate';

const PAGE_TITLES = { map: 'Apartment', schedule: 'Schedule', inventory: 'Inventory', requests: 'To-dos', profile: 'Profile' };


function App({ storageKey = 'roomie-v1', guest = false, initialData, account, onStateChange, onSaveCloudProfile, onCreateCloudHousehold, onCreateInvite, onSignOut }) {
  const [state, setState] = useState(() => initialData || loadDemoState({ getItem: () => localStorage.getItem(storageKey) }));
  const [page, setPage] = useState(initialData?.cloud && !initialData.householdId ? 'profile' : 'map');
  const needsHousehold = state.cloud && !state.householdId;
  useLayoutEffect(() => {
    const theme = document.querySelector('meta[name="theme-color"]');
    theme?.setAttribute('content', page === 'map' ? '#e3e8d7' : '#f2e2d2');
    return () => theme?.setAttribute('content', '#f2e2d2');
  }, [page]);
  useEffect(() => { if (initialData) setState(initialData); }, [initialData]);
  const [modal, setModal] = useState(null);
  const [toast, setToastValue] = useState('');
  const [toastVersion, setToastVersion] = useState(0);
  const [undo, setUndo] = useState(null);
  const [dragAnnouncement, setDragAnnouncement] = useState('');
  function setToast(message) { setToastValue(message); setUndo(null); setToastVersion(v => v + 1); }
  useEffect(() => installButtonFeedback(), []);
  const [filter, setFilter] = useState('active');
  const [draggingTask, setDraggingTask] = useState(null);
  const [dockHintRun, setDockHintRun] = useState(0);
  const [dockHintActive, setDockHintActive] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); setDraggingTask(null); setDragAnnouncement(''); }, [page]);
  useEffect(() => { if (account) { onStateChange?.(state); return; } try { localStorage.setItem(storageKey, JSON.stringify(state)); setStorageError(false); } catch { setStorageError(true); } }, [state]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 4300); return () => clearTimeout(timer); } }, [toast, toastVersion]);
  useEffect(() => { if (modal && toast) setToast(''); }, [modal, toast]);
  useEffect(() => { let timer; const refresh = () => { tick(value => value + 1); timer = setTimeout(refresh, 60000 - Date.now() % 60000); }; timer = setTimeout(refresh, 60000 - Date.now() % 60000); return () => clearTimeout(timer); }, []);
  useEffect(() => { if (account) return; const sync = e => { if (e.key === storageKey) setState(loadDemoState({ getItem: () => localStorage.getItem(storageKey) })); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  useEffect(() => {
    const refresh = () => tick(n => n + 1);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const me = state.people.find(p => p.id === state.currentUser);
  const openTasks = state.tasks.filter(t => t.status === 'open');
  const incoming = state.tasks.filter(t => t.status === 'pending' && t.to === me.id);

  function act(task, action, recipient, restockedQuantity) {
    if (!task) { setToast('This task is no longer available.'); return; }
    const before = state.tasks.find(t => t.id === task.id);
    if (!before) { setToast('This task is no longer available.'); return; }
    const next = transitionTask(before, action, me.id, recipient);
    if (next === before) { setToast(recipient === me.id ? 'Use “I’ll take this” to pick up a task yourself.' : 'This task has already been updated.'); return; }
    if (action === 'complete' && before.inventoryId && restockedQuantity === undefined) { setModal({ type: 'restock-complete', taskId: before.id, returnTo: modal }); return false; }
    const applied = applyTaskAction(state, task.id, action, me.id, recipient, restockedQuantity);
    if (applied === state) { setToast('The item or quantity changed. Review the count and try again.'); return false; }
    setState(s => applyTaskAction(s, task.id, action, s.currentUser, recipient, restockedQuantity));
    const messages = { flag: 'Flagged for attention.', suggest: `Suggestion sent to ${personName(state, recipient)}.`, claim: 'Task claimed.', accept: 'Suggestion accepted.', decline: 'Suggestion declined. Task is open.', complete: 'Task completed.', cancel: 'Suggestion withdrawn. The task is open again.' };
    setToast(messages[action]);
    setUndo({ taskId: task.id, before, after: next, removed: action === 'complete' && Boolean(before.inventoryId), object: state.objects.find(object => object.id === before.objectId), linkedItems: state.inventory.filter(item => item.objectId === before.objectId).map(item => item.id), stockBefore: state.inventory.find(item => item.id === before.inventoryId), stockAfter: applied.inventory.find(item => item.id === before.inventoryId) });
    taskFeedback(action, next);
    return true;
  }

  function undoTaskChange() {
    if (!undo) return;
    const current = state.tasks.find(t => t.id === undo.taskId);
    if (undo.removed && !current) {
      if (state.inventory.find(item => item.id === undo.before.inventoryId)?.quantity !== undo.stockAfter?.quantity || state.tasks.some(task => task.inventoryId === undo.before.inventoryId) || !state.inventory.some(item => item.id === undo.before.inventoryId) || (undo.before.to && !state.people.some(person => person.id === undo.before.to))) { setToast('This item has changed since then. Open it to review.'); return; }
      setState(s => ({ ...s, tasks: [...s.tasks, undo.before], objects: undo.object && !s.objects.some(object => object.id === undo.object.id) ? [...s.objects, undo.object] : s.objects, inventory: s.inventory.map(item => { const linked = undo.object && undo.linkedItems.includes(item.id) && !item.objectId ? { ...item, objectId: undo.object.id } : item; return item.id === undo.before.inventoryId && undo.stockBefore ? updateInventoryItem(linked, { quantity: undo.stockBefore.quantity, status: undo.stockBefore.status, buyerId: undo.stockBefore.buyerId }) : linked; }) }));
      setToast('Change undone.'); return;
    }
    if (!current || ['status', 'to', 'from', 'attention'].some(key => current[key] !== undo.after[key]) || (undo.before.to && !state.people.some(p => p.id === undo.before.to))) {
      setToast('This task has changed since then. Open it to review.');
      return;
    }
    const { before, taskId } = undo;
    setState(s => ({ ...s, tasks: s.tasks.map(task => task.id === taskId ? { ...task, status: before.status, to: before.to, from: before.from, attention: before.attention } : task) }));
    setToast('Change undone.');
  }

  function adjustStock(id, delta) {
    setState(s => ({ ...s, inventory: s.inventory.map(item => item.id === id ? adjustQuantity(item, delta) : item) }));
  }

  function restockTask(item, roomId, returnItemId, returnRoomId = roomId) {
    const object = state.objects.find(o => o.id === item.objectId);
    const existing = state.tasks.find(t => t.inventoryId === item.id && t.status !== 'done') || (object && state.tasks.find(t => t.objectId === object.id && t.title.toLowerCase() === `Restock ${item.name}`.toLowerCase() && t.status !== 'done'));
    if (existing) { if (!existing.inventoryId) setState(s => ({ ...s, tasks: s.tasks.map(task => task.id === existing.id ? { ...task, inventoryId: item.id } : task) })); setModal({ type: 'object', id: existing.objectId, taskId: existing.id, roomId: returnRoomId, returnItemId }); return; }
    const position = object ? null : nearbyRestockPosition({ ...item, roomId }, state.objects, state.inventory) || objectPosition(state.objects, roomId);
    if (!object && !position) { setToast('This room is full. Link this supply to an existing object to add a task.'); return; }
    const objectId = object?.id || uid();
    const taskId = uid();
    setState(s => ({ ...s,
      objects: object ? s.objects : [...s.objects, { id: objectId, type: 'supplies', name: item.name, roomId, ...position }],
      inventory: s.inventory.map(i => i.id === item.id ? { ...i, ...inventoryPosition(i, state.objects), objectId } : i),
      tasks: [...s.tasks, { id: taskId, objectId, inventoryId: item.id, title: `Restock ${item.name}`, status: 'open', from: s.currentUser, to: null }],
    }));
    setModal({ type: 'object', id: objectId, taskId, roomId: returnRoomId, returnItemId });
    setToast('Restock task added.');
  }

  return <>
    <header className={`app-header ${page === 'map' ? 'canvas-header' : ''}`}><div className="header-inner"><Brand onHome={e => { e.preventDefault(); setPage(needsHousehold ? 'profile' : 'map'); }}/>{page === 'map' && <div id="apartment-header-actions" className="header-map-actions"/>}<nav className="desktop-nav" aria-label="Main navigation">{[['map', 'Our apartment'], ['requests', 'To-dos'], ['schedule', 'Schedule'], ['inventory', 'Inventory'], ['profile', 'Profile']].map(([key, label]) => <button key={key} className={page === key ? 'active' : ''} disabled={needsHousehold && key !== 'profile'} onClick={() => setPage(key)}>{label}{key === 'requests' && incoming.length > 0 && <span className="nav-count">{incoming.length}</span>}</button>)}</nav></div></header>
    <main className={`app-main ${page === 'map' ? 'map-page' : ''}`}>
      <header className="page-heading"><h1>{PAGE_TITLES[page]}</h1></header>
      {storageError && <div className="notice" role="alert">Your browser couldn’t save changes. Keep this tab open; changes may be lost on refresh.</div>}
      {page !== 'map' && page !== 'requests' && incoming.length > 0 && <button className="incoming-banner" onClick={() => { setPage('requests'); setFilter('mine'); }}><Icon name="bell"/><span>You have {incoming.length} {incoming.length === 1 ? 'suggestion' : 'suggestions'} to respond to.</span><Icon name="arrow" size={18}/></button>}
      {page === 'map' && <div className={`home-grid ${dockHintActive ? 'is-task-hint' : ''}`}>
        <ApartmentWorkspace state={state} addingRoom={modal?.type === 'add-room'} onAddRoom={() => setModal({ type: 'add-room' })} onCloseAddRoom={() => setModal(null)}
          onAddTask={(roomChoices, onAdd, objects, inventory, tasks) => setModal({ type: 'add-task', roomChoices, onAdd, objects, inventory, tasks })} onAddItem={(roomChoices, onAdd, objects, inventory) => setModal({ type: 'inventory', roomChoices, onAdd, objects, inventory })} onRoom={id => setModal({ type: 'room', id })} onItem={itemId => setModal({ type: 'item', id: itemId })} onObject={id => setModal({ type: 'object', id })}
          onCommit={draft => { const next = commitLayout(state, draft); if (!next) { setToast('The layout changed. Cancel and try again.'); return false; } setState(next); setToast('Layout saved.'); return true; }}
          onTaskDrag={setDraggingTask} onTaskDropRejected={name => setToast(`${name} is busy right now. Try another roommate.`)} onDragAnnouncement={setDragAnnouncement} onTaskDrop={(task, person) => {
            if (!canReceiveTask(state.people.find(value => value.id === person))) { setToast('That roommate is busy right now. Try another roommate.'); return; }
            const available = objectTasks(state.tasks, task.objectId).filter(item => item.status === 'open');
            if (available.length > 1) setModal({ type: 'pick-task', id: task.objectId, personId: person });
            else if (person === me.id) act(task, 'claim');
            else setModal({ type: 'suggest', taskId: task.id, personId: person });
          }}/>
        <AvailabilityDock onManualOpen={() => setDockHintRun(run => run + 1)} people={state.people} currentUser={me.id} tasks={state.tasks} objects={state.objects} draggingTask={draggingTask} onPerson={id => setModal(id === me.id ? { type: 'status' } : { type: 'person', id })} onTask={(id, taskId) => setModal({ type: 'object', id, taskId })}/>
        <DockDragHint run={dockHintRun} state={state} disabled={Boolean(modal || draggingTask)} onActive={setDockHintActive}/>

      </div>}
      {page === 'requests' && <TodoPage state={state} filter={filter} onFilter={setFilter} onAct={act} onOpen={task => setModal(task.status === 'done' ? { type: 'history', id: task.id } : { type: 'object', id: task.objectId, taskId: task.id })} onSuggest={task => setModal({ type: 'suggest', taskId: task.id })} onAddTask={onCreated => setModal({ type: 'add-task', onCreated })}/>}
      {page === 'schedule' && <SchedulePage people={state.people} currentUser={me.id} onSaveRoutine={routine => { setState(value => ({ ...value, people: value.people.map(person => person.id === value.currentUser ? { ...person, routine, status: null, expires: null } : person) })); setToast('Availability saved.'); }}/>}
      {page === 'inventory' && <InventoryPage state={state} onAdd={() => setModal({ type: 'inventory' })} onEdit={item => setModal({ type: 'inventory', id: item.id })} onAdjust={adjustStock} onOpen={item => setModal({ type: 'item', id: item.id })}/>}
      {page === 'profile' && <ProfilePage state={state} onSaveProfile={async fields => { try { if (onSaveCloudProfile) await onSaveCloudProfile(fields); setState(s => updateOwnProfile(s, s.currentUser, fields)); setToast('Profile saved.'); return true; } catch { setToast('Your profile couldn’t be saved. Please try again.'); return false; } }} guest={guest} onSignOut={onSignOut ? () => onSignOut().catch(() => setToast('Your changes haven’t synced yet. Please try again before signing out.')) : undefined} onCreateHousehold={() => { if (needsHousehold) setModal({ type: 'create-household' }); }} onInvite={() => setModal({ type: 'invite' })} onHousehold={() => setModal({ type: 'household' })} onPerson={id => setModal({ type: 'person', id })}/>}
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{[['map', 'map', 'Apartment'], ['requests', 'requests', 'To-dos'], ['schedule', 'calendar', 'Schedule'], ['inventory', 'supplies', 'Inventory'], ['profile', 'user', 'Profile']].map(([key, icon, label]) => <button key={key} disabled={needsHousehold && key !== 'profile'} onClick={() => setPage(key)} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined}><span><Icon name={icon} size={21}/>{key === 'requests' && incoming.length > 0 && <i className="mobile-badge"/>}</span>{label}</button>)}</nav>
    {toast && <Toast message={toast} version={toastVersion} modal={modal} canUndo={Boolean(undo)} onUndo={undoTaskChange}/ >}
    <div className="sr-only" aria-live="polite" aria-atomic="true">{dragAnnouncement}</div>
    {modal?.type === 'create-household' && needsHousehold && <HouseholdDialog creating onClose={() => setModal(null)} onSave={async name => { try { if (onCreateCloudHousehold) await onCreateCloudHousehold(name); else { const id = uid(); setState(s => createHousehold(s, name, id)); } setModal(null); setUndo(null); setToast('Household created.'); } catch { setToast('The household couldn’t be created. Please try again.'); } }}/>}
    {modal?.type === 'invite' && <InviteDialog guest={guest} householdName={state.apartment} onCreate={onCreateInvite} onClose={() => setModal(null)}/>}
    {modal?.type === 'household' && <HouseholdDialog name={state.apartment} onClose={() => setModal(null)} onSave={apartment => { setState(s => ({ ...s, apartment })); setModal(null); setToast('Household name saved.'); }}/ >}
    {modal?.type === 'room' && <RoomDialog state={state} roomId={modal.id} onCommitPlacement={draft => { const next = commitRoomPlacement(state, draft); if (!next) return false; setState(next); setToast('Placement saved.'); return true; }} onClose={() => setModal(null)} onAdd={roomId => setModal({ type: 'inventory', roomId })} onAddTask={roomId => setModal({ type: 'add-task', roomId })} onObject={id => setModal({ type: 'object', id, roomId: modal.id })} onItem={id => setModal({ type: 'item', id, roomId: modal.id })}/>}
    {modal?.type === 'restock-complete' && <RestockCompleteDialog state={state} taskId={modal.taskId} onClose={() => setModal(modal.returnTo || null)} onConfirm={amount => { if (act(state.tasks.find(task => task.id === modal.taskId), 'complete', undefined, amount)) { const origin = modal.returnTo; setModal(origin?.returnItemId ? { type: 'item', id: origin.returnItemId, roomId: origin.roomId } : origin?.roomId ? { type: 'room', id: origin.roomId } : null); } }}/ >}
    {modal?.type === 'item' && <ItemDetailDialog state={state} itemId={modal.id} onClose={() => setModal(modal.returnItemId ? { type: 'item', id: modal.returnItemId, roomId: modal.roomId } : modal.roomId ? { type: 'room', id: modal.roomId } : null)} onAdjust={adjustStock} onEdit={item => setModal({ type: 'inventory', id: item.id, roomId: modal.roomId, returnItemId: item.id })} onRestock={page === 'inventory' ? undefined : item => restockTask(item, item.roomId, modal.id, modal.roomId || null)}/>}
    {modal?.type === 'inventory' && <InventoryItemDialog inventory={modal.inventory || state.inventory} tasks={state.tasks} people={state.people} key={modal.id || 'new'} item={state.inventory.find(item => item.id === modal.id)} rooms={modal.roomChoices || state.rooms} objects={modal.objects || state.objects} defaultRoomId={modal.roomId} defaultObjectId={modal.objectId} onClose={() => setModal(modal.returnItemId ? { type: 'item', id: modal.returnItemId, roomId: modal.roomId } : modal.roomId ? { type: 'room', id: modal.roomId } : null)}
      onSave={item => { const id = item.id || uid(); const fields = { name: item.name, status: item.status, roomId: item.roomId, objectId: item.objectId, notes: item.notes, quantity: item.quantity, unit: item.unit, lowAt: item.lowAt, storage: item.storage, x: item.x, y: item.y }; if (modal.onAdd) { modal.onAdd(updateInventoryItem({ id, buyerId: null }, fields)); setModal(null); return; } setState(s => { const existing = s.inventory.find(i => i.id === id); const saved = updateInventoryItem(existing || { id, buyerId: null }, fields); return { ...s, inventory: existing ? s.inventory.map(i => i.id === id ? saved : i) : [...s.inventory, saved] }; }); setModal(modal.returnItemId ? { type: 'item', id: modal.returnItemId, roomId: modal.roomId } : modal.roomId ? { type: 'room', id: modal.roomId } : null); setToast('Shared supply saved.'); }}
      onDelete={id => { setState(s => ({ ...s, inventory: s.inventory.filter(item => item.id !== id) })); setModal(modal.roomId ? { type: 'room', id: modal.roomId } : null); setToast('Shared supply removed.'); }}/ >}
    {modal?.type === 'pick-task' && <Modal title="Which task?" subtitle={`${objectName(state.objects.find(o => o.id === modal.id))} · ${personName(state, modal.personId)}`} onClose={() => setModal(null)}>{objectTasks(state.tasks, modal.id).filter(t => t.status === 'open').map(task => <button key={task.id} className="choice-row" onClick={() => { if (modal.personId === me.id) { act(task, 'claim'); setModal(null); } else setModal({ type: 'suggest', taskId: task.id, personId: modal.personId }); }}>{task.title}<Icon name="arrow" size={17}/></button>)}</Modal>}
    {modal?.type === 'object' && <ObjectDialog key={`${modal.id}-${modal.taskId || ''}`} state={state} id={modal.id} taskId={modal.taskId} me={me} act={act} onClose={() => setModal(modal.returnItemId ? { type: 'item', id: modal.returnItemId, roomId: modal.roomId } : modal.roomId ? { type: 'room', id: modal.roomId } : null)} onSuggest={task => setModal({ type: 'suggest', taskId: task.id })}
      onRemoveTask={taskId => { setState(s => removeRestockTask(s, taskId)); setModal(modal.returnItemId ? { type: 'item', id: modal.returnItemId, roomId: modal.roomId } : modal.roomId ? { type: 'room', id: modal.roomId } : null); setToast('Restock task removed.'); }}
      onFlag={(object, title, notes = '', attention = true) => { setState(s => ({ ...s, tasks: [...s.tasks, { id: uid(), objectId: object.id, title, notes, attention, status: 'open', from: me.id, to: null }] })); setToast('Task added.'); }}
      onUpdateTask={updated => { setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === updated.id ? { ...t, title: updated.title, notes: updated.notes } : t) })); setToast('Task updated.'); }}
      onRemove={id => { setState(s => ({ ...s, objects: s.objects.filter(o => o.id !== id), tasks: s.tasks.filter(t => t.objectId !== id), inventory: s.inventory.map(item => item.objectId === id ? { ...item, objectId: null } : item) })); setModal(null); setToast('Object removed from the map.'); }}/ >}
    {modal?.type === 'suggest' && <SuggestionDialog state={state} task={state.tasks.find(t => t.id === modal.taskId)} defaultPerson={modal.personId} me={me} onHousehold={() => { setModal(null); setPage('profile'); }} onClose={() => setModal(null)} onSend={id => { act(state.tasks.find(t => t.id === modal.taskId), 'suggest', id); setModal(null); }}/ >}
    {modal?.type === 'add-task' && <AddTaskDialog inventory={modal.inventory || state.inventory} tasks={modal.tasks || state.tasks} people={state.people} defaultRoomId={modal.roomId} objects={modal.objects || state.objects} rooms={modal.roomChoices || state.rooms} onClose={() => setModal(modal.returnItemId ? { type: 'item', id: modal.returnItemId, roomId: modal.roomId } : modal.roomId ? { type: 'room', id: modal.roomId } : null)} onEdit={() => { setPage('map'); setModal({ type: 'add-room' }); }} onAdd={(object, firstTask) => { if (modal.onAdd) { if (!modal.onAdd(object, firstTask)) { setToast('This room is full. Choose another room.'); return; } setModal(null); return; } const position = objectPosition(state.objects, object.roomId, object); if (!position) { setToast('This room is full of objects. Choose another room or remove an unused object.'); return; } const id = uid(); setState(s => ({ ...s, objects: [...s.objects, { ...object, ...position, id }], tasks: firstTask ? [...s.tasks, { id: uid(), objectId: id, title: firstTask, attention: false, status: 'open', from: me.id, to: null }] : s.tasks })); modal.onCreated?.(); setModal(modal.returnItemId ? { type: 'item', id: modal.returnItemId, roomId: modal.roomId } : modal.roomId ? { type: 'room', id: modal.roomId } : null); setToast('Task added.'); }}/ >}
    {modal?.type === 'status' && <AvailabilityDialog me={me} onClose={() => setModal(null)} onSaveRoutine={routine => { setState(value => ({ ...value, people: value.people.map(person => person.id === value.currentUser ? { ...person, routine, status: null, expires: null } : person) })); setToast('Availability saved.'); }}/ >}
    {modal?.type === 'history' && (() => { const task = state.tasks.find(t => t.id === modal.id); return <Modal title="Completed task" subtitle="Completed responsibility" onClose={() => setModal(null)}><div className="object-detail-icon"><Icon name="check" size={34}/></div><h3 className="object-task-title">{task.title}</h3><p className="object-detail-copy">Completed by {personName(state, task.to)}.</p><button className="button subtle full-width" onClick={() => setModal(null)}>Done</button></Modal>; })()}
    {modal?.type === 'person' && <PersonDialog person={state.people.find(p => p.id === modal.id)} tasks={openTasks} rooms={state.rooms} objects={state.objects} currentUser={me.id} onClose={() => setModal(null)} onSuggest={(task, personId) => setModal({ type: 'suggest', taskId: task.id, personId })}/>}
  </>;
}

// Object details and task management are kept together so a map object can own several tasks.
function SuggestionDialog({ state, task, defaultPerson, me, onClose, onSend, onHousehold }) {
  const [person, setPerson] = useState(defaultPerson || '');
  const roommates = state.people.filter(p => p.id !== me.id);
  const selected = roommates.some(p => p.id === person) ? person : '';
  const available = task?.status === 'open';
  return <Modal title="Suggest task" subtitle={task?.title} className="suggestion-modal" onClose={onClose}>
    {!available ? <p className="suggestion-empty" role="status">This task is no longer available for suggestions.</p> : roommates.length ? <>
      <p className="suggestion-label" id="suggestion-choices-label">Choose a roommate</p>
      <div className="suggestion-choices" role="group" aria-labelledby="suggestion-choices-label">{roommates.map(p => <button key={p.id} className={`suggestion-person ${selected === p.id ? 'chosen' : ''}`} onClick={() => setPerson(p.id)} aria-pressed={selected === p.id}>
        <Avatar person={p}/><span className="suggestion-person-copy"><strong>{p.name}</strong><span>{availabilityLabel(p)}</span></span><span className="suggestion-check" aria-hidden="true">{selected === p.id && <Icon name="check" size={14}/>}</span>
      </button>)}</div>
    </> : <div className="suggestion-empty"><Icon name="people" size={26}/><p>Add a roommate to your apartment to send suggestions.</p><button className="button subtle" onClick={onHousehold}>Go to Profile</button></div>}
    <div className="suggestion-actions"><button className="button subtle" onClick={onClose}>Cancel</button><button className="button primary" disabled={!selected || !available} onClick={() => onSend(selected)}>Send suggestion<Icon name="arrow" size={15}/></button></div>
  </Modal>;
}

function Application() {
  const [hello, setHello] = useState(() => location.hash === '#hello');
  const [appStarted, setAppStarted] = useState(() => location.hash !== '#hello');
  useEffect(() => {
    const navigate = () => {
      const next = location.hash === '#hello';
      if (!next) setAppStarted(true);
      setHello(next);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  // Keep edits and pending sync alive when opening the demonstration from Nest.
  return <>
    {appStarted && <div className="application-shell" inert={hello ? true : undefined} aria-hidden={hello || undefined} style={hello ? { visibility: 'hidden' } : undefined}><CloudShell App={App}/></div>}
    {hello && <HelloPage/>}
  </>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><Application/></React.StrictMode>);
