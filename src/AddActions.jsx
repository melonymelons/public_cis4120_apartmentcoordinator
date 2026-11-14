import React from 'react';
import Icon from './Icons';

export default function AddActions({ onTask, onItem, compact = false, itemPrimary = false, taskLabel = 'Add task' }) {
  return <div className={`add-actions ${compact ? 'compact' : ''}`}>
    <button className={`button ${itemPrimary ? 'subtle' : 'primary'} ${compact ? 'small-button' : ''}`} onClick={onTask}><Icon name="plus" size={15}/>{taskLabel}</button>
    <button className={`button ${itemPrimary ? 'primary' : 'subtle'} ${compact ? 'small-button' : ''}`} onClick={onItem}><Icon name="plus" size={15}/>Add item</button>
  </div>;
}
