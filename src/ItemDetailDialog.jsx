import React from 'react';
import Modal from './Modal';
import Icon from './Icons';
import SupplyQuantity, { SupplyIcon } from './SupplyQuantity';

export default function ItemDetailDialog({ state, itemId, onClose, onEdit, onAdjust, onRestock }) {
  const item = state.inventory.find(item => item.id === itemId);
  if (!item) return <Modal title="Item unavailable" onClose={onClose}><p>This item was removed.</p></Modal>;
  const room = state.rooms.find(room => room.id === item.roomId);
  return <Modal title={item.name} subtitle={room?.name} className="item-detail-modal" onClose={onClose}>
    <div className="item-detail-content">
      <div className="item-detail-stock"><span className="item-detail-icon"><SupplyIcon item={item} size={30}/></span><SupplyQuantity item={item} onAdjust={onAdjust} onEdit={onEdit}/></div>
      {item.storage && <p className="item-detail-storage"><Icon name="map" size={14}/>{item.storage}</p>}
      {item.notes && <p className="item-detail-notes">{item.notes}</p>}
      <div className="item-detail-actions"><button className="button subtle" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Icon name="edit" size={15}/>Edit item</button>{onRestock && <button className="button subtle item-restock-action" onClick={() => onRestock(item)}><Icon name="plus" size={15}/>Restock task</button>}</div>
    </div>
  </Modal>;
}
