import React, { useEffect, useId, useRef } from 'react';
import Icon from './Icons';

export default function Modal({ title, subtitle, onClose, children, wide = false, className = '', style, footer, role, descriptionId }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => { const el = dialog.current; el.showModal(); el.querySelector('[data-initial-focus]')?.focus({ preventScroll: true }); return () => el.close(); }, []);
  const content = <>
    <div className="modal-heading"><div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close"/></button></div>
    <div className="modal-body">{children}</div>
  </>;
  return <dialog ref={dialog} className={`modal ${wide ? 'wide' : ''} ${className}`} style={style} role={role} aria-describedby={descriptionId} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }} aria-labelledby={titleId}>
    {footer ? <><div className="modal-surface">{content}</div>{footer}</> : content}
  </dialog>;
}
