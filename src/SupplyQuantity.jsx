import React from 'react';
import Icon from './Icons';
import { hasQuantity, quantityLabel } from './inventory';

export function SupplyIcon({ item, size = 24 }) {
  const icon = /paper|roll|tissue/i.test(item.name) ? 'roll' : /soap|shampoo|detergent|cleaner/i.test(item.name) ? 'bottle' : 'supplies';
  return <Icon name={icon} size={size}/>;
}

export default function SupplyQuantity({ item, onAdjust, onEdit }) {
  if (!hasQuantity(item)) return <button className="text-button set-quantity" onClick={() => onEdit(item)} aria-label={`Set quantity for ${item.name}`}><Icon name="plus" size={14}/>Set quantity</button>;
  return <div className="quantity-stepper" role="group" aria-label={`${item.name} quantity`}>
    <button onClick={() => onAdjust(item.id, -1)} disabled={item.quantity === 0} aria-label={`Use one ${item.name}`} title="Used one"><Icon name="minus" size={15}/></button>
    <output aria-live="polite" aria-atomic="true"><span key={item.quantity} className="quantity-value">{quantityLabel(item)}</span></output>
    <button onClick={() => onAdjust(item.id, 1)} disabled={item.quantity >= 99999} aria-label={`Add one ${item.name}`} title="Add one"><Icon name="plus" size={15}/></button>
  </div>;
}
