import React, { useRef, useState } from 'react';
import Icon from './Icons';
import Modal from './Modal';
import SelectMenu from './SelectMenu';
import ItemPlacement from './ItemPlacement';
import { ProfileSection } from './ProfilePage';
import { ROOM_TYPES, objectPosition } from './model';
import SupplyQuantity, { SupplyIcon } from './SupplyQuantity';
import { STOCK_LEVELS, needsRestocking, hasQuantity, quantityStatus, inventoryPosition } from './inventory';

export default function InventoryPage({ state, onAdd, onEdit, onOpen, onAdjust }) {
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [filter, setFilter] = useState('all');
  const [sections, setSections] = useState({});
  const toggle = id => setSections(value => ({ ...value, [id]: value[id] === false }));
  const roomId = state.rooms.some(room => room.id === selectedRoom) ? selectedRoom : 'all';
  const needs = state.inventory.filter(needsRestocking).length;
  const query = search.trim().toLowerCase();
  const items = state.inventory.filter(item => (filter === 'all' || needsRestocking(item)) && (roomId === 'all' || item.roomId === roomId) && `${item.name} ${item.storage || ''} ${item.notes || ''}`.toLowerCase().includes(query));
  const groups = [...state.rooms.map(room => ({ ...room, items: items.filter(item => item.roomId === room.id) })), { id: 'unplaced', name: 'Needs a room', items: items.filter(item => !state.rooms.some(room => room.id === item.roomId)) }].filter(group => group.items.length);
  const clear = () => { setSearch(''); setSelectedRoom('all'); setFilter('all'); };
  return <section className="list-page inventory-page"><div className="inventory-section-layout">
    <div className="inventory-global-tools">
    <div className="inventory-page-toolbar"><button className="button primary inventory-add-item" onClick={onAdd}><Icon name="plus" size={15}/>Add item</button></div>
    <div className="inventory-tools"><div className="inventory-search"><Icon name="search" size={17}/><input aria-label="Search supplies" placeholder="Search items" value={search} onChange={event => setSearch(event.target.value)}/>{search && <button type="button" aria-label="Clear inventory search" onClick={() => setSearch('')}><Icon name="close" size={13}/></button>}</div><label className="sr-only" htmlFor="inventory-room-filter">Filter inventory by room</label><SelectMenu id="inventory-room-filter" value={roomId} onChange={setSelectedRoom} options={[{ value: 'all', label: 'All rooms', icon: 'home' }, ...state.rooms.map(room => ({ value: room.id, label: room.name, icon: ROOM_TYPES[room.type]?.icon }))]}/></div>
    <div className="inventory-filter-tabs" role="group" aria-label="Filter inventory"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All items <span>{state.inventory.length}</span></button><button aria-pressed={filter === 'needed'} onClick={() => setFilter('needed')}><Icon name="supplies" size={14}/>Low stock <span>{needs}</span></button></div>
    </div>
    {groups.length ? <div className="inventory-room-list">{groups.map((group, index) => <ProfileSection key={group.id} id={`inventory-room-${group.id}`} title={group.name} icon={ROOM_TYPES[group.type]?.icon || 'home'} count={group.items.length} ariaLabel={`${group.name} items`} className={`inventory-room-group ${index % 2 === 0 ? 'household-section' : ''}`} open={sections[group.id] !== false} onToggle={() => toggle(group.id)}>
      <div className="inventory-list">{group.items.map(item => {
        const stock = STOCK_LEVELS[item.status] || STOCK_LEVELS.unknown;
        return <article className={`inventory-item stock-${item.status}`} key={item.id} aria-label={item.name}>
          <button className="inventory-item-open" onClick={() => onOpen(item)} aria-label={`View ${item.name}`}><span className="inventory-item-icon"><SupplyIcon item={item} size={24}/></span><span className="inventory-item-name"><strong>{item.name}</strong>{item.storage && <span>{item.storage}</span>}</span><Icon name="chevron" size={15}/></button>
          <div className="inventory-quantity-control"><span className="inventory-quantity-label">Quantity<small className={`stock-summary stock-${item.status}`}>{hasQuantity(item) ? stock.label : 'Not counted'}</small></span><SupplyQuantity item={item} onAdjust={onAdjust} onEdit={onEdit}/></div>
          <div className="inventory-row-actions"><button className="button subtle inventory-edit-action" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Icon name="edit" size={15}/>Edit item</button></div>
        </article>;
      })}</div>
    </ProfileSection>)}</div> : <div className="large-empty inventory-empty"><span className="inventory-empty-icon"><Icon name={filter === 'needed' && !query ? 'check' : 'supplies'} size={30}/></span><h3>{!state.inventory.length ? 'No items yet' : filter === 'needed' && !query && roomId === 'all' ? 'Everything is stocked' : 'No matching items'}</h3>{state.inventory.length > 0 && <button className="button subtle" onClick={clear}>Show all items</button>}</div>}
  </div></section>;
}

export function InventoryItemDialog({ item, rooms, objects, defaultRoomId = '', defaultObjectId = '', inventory = [], tasks = [], people = [], onClose, onSave, onDelete }) {
  const [name, setName] = useState(item?.name || '');
  const status = item?.status || 'unknown';
  const [roomId, setRoomId] = useState(() => rooms.find(room => room.id === (item?.roomId || defaultRoomId))?.id || rooms[0]?.id || '');
  const [objectId, setObjectId] = useState(item?.objectId || defaultObjectId);
  const [notes, setNotes] = useState(item?.notes || '');
  const [quantity, setQuantity] = useState(hasQuantity(item || {}) ? String(item.quantity) : '');
  const [unit, setUnit] = useState(item?.unit || 'items');
  const [lowAt, setLowAt] = useState(String(item?.lowAt ?? 2));
  const [storage, setStorage] = useState(item?.storage || '');
  const [confirm, setConfirm] = useState(false);
  const stock = quantity === '' ? status : quantityStatus(Number(quantity), Number(lowAt));
  const form = useRef(null);
  const [placing, setPlacing] = useState(false);
  const [position, setPosition] = useState(null);
  const [placementDraft, setPlacementDraft] = useState(null);
  const [dragging, setDragging] = useState(false);
  const room = rooms.find(room => room.id === roomId);
  const draft = () => ({ ...item, name: name.trim(), status, roomId, objectId: objectId || null, notes: notes.trim(), quantity: quantity === '' ? null : Number(quantity), unit: unit.trim() || 'items', lowAt: Number(lowAt), storage: storage.trim(), x: roomId === item?.roomId && objectId === (item?.objectId || '') ? item?.x : undefined, y: roomId === item?.roomId && objectId === (item?.objectId || '') ? item?.y : undefined });
  function beginPlacement() {
    if (!form.current.reportValidity() || !room) return;
    const next = draft();
    if (!position || placementDraft?.roomId !== roomId || placementDraft?.objectId !== next.objectId) {
      const preferred = inventoryPosition({ ...next, id: item?.id || 'new-item' }, objects);
      const occupied = [...objects, ...inventory.filter(other => other.id !== item?.id).map(other => ({ roomId: other.roomId, ...inventoryPosition(other, objects) }))];
      setPosition(item?.roomId === roomId && Number.isFinite(item.x) && Number.isFinite(item.y) ? preferred : objectPosition(occupied, roomId, preferred) || preferred);
    }
    setPlacementDraft(next); setPlacing(true);
  }
  return <><Modal title={placing ? 'Place item' : item ? 'Edit item' : 'Add item'} className={`add-object-modal item-editor-modal ${placing ? 'object-placement-modal' : ''}`} onClose={onClose} footer={placing && room ? <div className="object-placement-actions"><button type="button" className="button subtle" onClick={() => setPlacing(false)}>Back</button><button type="button" className="button primary" disabled={dragging || !position} onClick={() => onSave({ ...placementDraft, ...position })}>Confirm<Icon name="check" size={16}/></button></div> : undefined}>
    {placing && room ? <ItemPlacement room={room} item={placementDraft} inventory={inventory} objects={objects} tasks={tasks} people={people} position={position} onPosition={setPosition} onDragging={setDragging}/> : <form ref={form} className="item-editor-form" onSubmit={event => { event.preventDefault(); if (!name.trim() || !room) return; if (!item || item.roomId !== roomId) beginPlacement(); else onSave({ ...draft(), ...(position && placementDraft?.roomId === roomId ? position : {}) }); }}>
      <div className="item-editor-name"><span className="item-editor-preview" aria-hidden="true"><SupplyIcon item={{ name }} size={26}/></span><div><label className="field-label" htmlFor="supply-name">Item name</label><input id="supply-name" required maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Toilet paper" autoComplete="off"/></div></div>
      <div className="supply-count-fields"><div><label className="field-label" htmlFor="supply-quantity">Quantity (optional)</label><input id="supply-quantity" type="number" inputMode="numeric" min="0" max="99999" step="1" placeholder="Not counted" value={quantity} onChange={e => setQuantity(e.target.value)}/></div><div><label className="field-label" htmlFor="supply-unit">Unit</label><input id="supply-unit" maxLength={20} required value={unit} onChange={e => setUnit(e.target.value)} placeholder="rolls, bottles…"/></div></div>
      {quantity !== '' && <div className="item-editor-stock"><div><label className="field-label" htmlFor="supply-low">Low stock at or below</label><input id="supply-low" type="number" inputMode="numeric" min="0" max="99999" step="1" required value={lowAt} onChange={e => setLowAt(e.target.value)}/></div><span className={`item-stock-preview stock-${stock}`} role="status"><Icon name={STOCK_LEVELS[stock].icon} size={14}/>{STOCK_LEVELS[stock].label}</span></div>}
      <div><label className="field-label" htmlFor="supply-room">Room</label>{rooms.length ? <SelectMenu id="supply-room" value={roomId} onChange={value => { setRoomId(value); setObjectId(''); }} options={rooms.map(room => ({ value: room.id, label: room.name, icon: ROOM_TYPES[room.type]?.icon }))}/> : <p className="item-editor-no-room">Add a room before adding an item.</p>}</div>
      <section className="item-editor-details" aria-label="More details">
        <p className="item-editor-details-title">More details</p>
        <div className="item-editor-extra">
          <label className="field-label" htmlFor="supply-storage">Storage spot (optional)</label><input id="supply-storage" maxLength={60} placeholder="Cabinet, top shelf…" value={storage} onChange={e => setStorage(e.target.value)}/>
          <label className="field-label" htmlFor="supply-notes">Notes (optional)</label><textarea id="supply-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={300}/>
        </div>
      </section>
      {item && room && <button className="button subtle item-change-placement" type="button" onClick={beginPlacement}><Icon name="map" size={15}/>Change placement</button>}
      {item && <button type="button" className="button subtle item-editor-remove" onClick={() => setConfirm(true)}><Icon name="trash" size={14}/>Remove item</button>}
      <div className="item-editor-actions"><button className="button subtle" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={!name.trim() || !rooms.some(room => room.id === roomId)}>{item ? 'Save item' : 'Add item'}<Icon name={item ? 'check' : 'plus'} size={16}/></button></div>
    </form>}
  </Modal>
  {confirm && item && <Modal title="Remove item?" role="alertdialog" className="remove-confirmation" onClose={() => setConfirm(false)}>
    <p>Remove <strong>{item.name}</strong> from inventory? Its restock tasks will remain.</p>
    <div className="remove-confirmation-actions"><button className="button subtle" onClick={() => setConfirm(false)}>Cancel</button><button className="button remove-confirmation-submit" onClick={() => onDelete(item.id)}><Icon name="trash" size={15}/>Yes, remove</button></div>
  </Modal>}
  </>;
}
