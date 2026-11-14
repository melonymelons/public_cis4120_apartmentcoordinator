import React, { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icons';

export default function SelectMenu({ id, value, options, onChange }) {
  const listId = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);
  function choose(index) { onChange(options[index].value); setOpen(false); trigger.current?.focus(); }
  function keydown(event) {
    const key = event.key;
    if (key === 'Tab') { setOpen(false); return; }
    if (key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key)) {
      event.preventDefault();
      if (key === 'Enter' || key === ' ') {
        if (open) choose(active); else { setActive(selected); setOpen(true); }
      } else {
        setActive(key === 'Home' ? 0 : key === 'End' ? options.length - 1 : !open ? selected : (active + (key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
        setOpen(true);
      }
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      search.current = { text: (now - search.current.time < 600 ? search.current.text : '') + key.toLowerCase(), time: now };
      const match = options.findIndex(option => option.label.toLowerCase().startsWith(search.current.text));
      if (match >= 0) { event.preventDefault(); setActive(match); setOpen(true); }
    }
  }
  return <div ref={root} className={`select-menu ${open ? 'is-open' : ''}`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} id={id} type="button" className="select-menu-trigger" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${active}` : undefined} onKeyDown={keydown} onClick={() => { setActive(selected); setOpen(!open); }}>
      {options[selected]?.icon && <Icon name={options[selected].icon} size={17}/>}<span>{options[selected]?.label}</span><Icon name="down" size={16}/>
    </button>
    {open && <div id={listId} role="listbox" aria-labelledby={id} className="select-menu-options">{options.map((option, index) => <button key={option.value} type="button" id={`${listId}-${index}`} role="option" aria-selected={option.value === value} tabIndex={-1} className={index === active ? 'highlighted' : ''} onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => choose(index)}>
      {option.icon && <Icon name={option.icon} size={17}/>}<span>{option.label}</span>{option.value === value && <Icon name="check" size={15}/>}
    </button>)}</div>}
  </div>;
}
