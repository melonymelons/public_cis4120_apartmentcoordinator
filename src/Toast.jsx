import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icons';

export default function Toast({ message, version, modal, canUndo, onUndo }) {
  const busyNotice = message.endsWith('Try another roommate.');
  const notice = useRef(null);
  const [position, setPosition] = useState(undefined);
  useLayoutEffect(() => {
    if (modal) return;
    const dock = document.querySelector('.availability-dock');
    const align = () => {
      if (!dock) { setPosition(undefined); return; }
      const rect = dock.getBoundingClientRect();
      const halfWidth = (notice.current?.getBoundingClientRect().width || 0) / 2;
      const center = Math.max(12 + halfWidth, Math.min(window.innerWidth - 12 - halfWidth, rect.left + rect.width / 2));
      setPosition({ left: center, right: 'auto', translate: '-50% 0', bottom: window.innerHeight - rect.top + 18 });
    };
    align();
    const observer = new ResizeObserver(align);
    if (dock) observer.observe(dock);
    if (notice.current) observer.observe(notice.current);
    window.addEventListener('resize', align);
    return () => { observer.disconnect(); window.removeEventListener('resize', align); };
  }, [message, version, modal]);
  if (modal) return null;
  return createPortal(<div ref={notice} className={`toast${message === 'Layout saved.' ? ' toast-layout' : ''}${busyNotice ? ' toast-busy' : ''}`} style={position} role="status" key={version}><Icon name={busyNotice ? 'clock' : 'check'} size={18}/><span>{message}</span>{canUndo && <button className="toast-undo" onClick={onUndo}>Undo</button>}</div>, document.body);
}
