import React, { useState } from 'react';
import Modal from './Modal';
import Icon from './Icons';
import { hasQuantity, quantityLabel } from './inventory';

export default function RestockCompleteDialog({ state, taskId, onClose, onConfirm }) {
  const [amount, setAmount] = useState('');
  const task = state.tasks.find(task => task.id === taskId);
  const item = state.inventory.find(item => item.id === task?.inventoryId);
  if (!item || task?.status !== 'assigned' || task.to !== state.currentUser) return <Modal title="Restock unavailable" onClose={onClose}><p>The item or task has changed. Close this panel to review it.</p></Modal>;
  const current = hasQuantity(item) ? item.quantity : 0;
  const added = Number(amount), total = current + added;
  const valid = amount !== '' && Number.isSafeInteger(added) && added > 0 && total <= 99999;
  return <Modal title="How many did you restock?" subtitle={item.name} className="restock-complete-modal" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); if (valid) onConfirm(added); }}>
      <label className="field-label" htmlFor="restock-added">Quantity restocked</label>
      <div className="restock-amount"><input id="restock-added" type="number" inputMode="numeric" min="1" max={99999 - current} step="1" required data-initial-focus value={amount} onChange={event => setAmount(event.target.value)}/><span>{item.unit || 'items'}</span></div>
      <p className="restock-current">{hasQuantity(item) ? `Current: ${quantityLabel(item)}` : 'Current count is not set. The amount added will become the count.'}</p>
      <p className="restock-total" role="status">{valid ? <>After restock: <strong>{quantityLabel({ ...item, quantity: total })}</strong></> : '\u00a0'}</p>
      <div className="restock-complete-actions"><button type="button" className="button subtle" onClick={onClose}>Back</button><button className="button primary" disabled={!valid}>Confirm restock<Icon name="check" size={16}/></button></div>
    </form>
  </Modal>;
}
