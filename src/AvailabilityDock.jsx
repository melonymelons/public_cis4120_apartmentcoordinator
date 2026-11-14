import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icons';
import AvailabilityTrays from './AvailabilityTrays';
import { reduceMotion } from './motion';

export default function AvailabilityDock(props) {
  const [open, setOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const expanded = open || Boolean(props.draggingTask) || settling;
  const dock = useRef(null), bounds = useRef(null), transition = useRef(null);
  useLayoutEffect(() => {
    const el = dock.current;
    const before = transition.current ? el.getBoundingClientRect() : bounds.current;
    transition.current?.cancel(); transition.current = null;
    const after = el.getBoundingClientRect(); bounds.current = after;
    if (!before || reduceMotion() || !el.animate || Math.abs(before.width - after.width) + Math.abs(before.height - after.height) < 1) return;
    const parent = el.offsetParent, origin = parent.getBoundingClientRect();
    const frame = rect => ({
      left: `${rect.left - origin.left - parent.clientLeft + parent.scrollLeft}px`,
      top: `${rect.top - origin.top - parent.clientTop + parent.scrollTop}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
      right: 'auto', bottom: 'auto', translate: 'none', overflow: 'hidden',
    });
    // Animate actual dimensions rather than scaling the text and avatars.
    // Reveal an already-targeted tray in place during a task drag, so its drop
    // coordinates do not move away from the pointer as the panel opens.
    const frames = props.draggingTask
      ? [{ clipPath: `inset(${Math.max(0, 100 - before.height / after.height * 100)}% 0 0 0)` }, { clipPath: 'inset(0)' }]
      : [frame(before), frame(after)];
    const animation = el.animate(frames, {
      duration: props.draggingTask ? 220 : 340, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both',
    });
    transition.current = animation;
    animation.finished.then(() => {
      if (transition.current !== animation) return;
      animation.cancel(); transition.current = null; bounds.current = el.getBoundingClientRect();
    }).catch(() => {});
  }, [expanded]);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => { if (!transition.current) bounds.current = dock.current.getBoundingClientRect(); });
    observer.observe(dock.current);
    return () => { observer.disconnect(); transition.current?.cancel(); };
  }, []);
  useEffect(() => {
    if (props.draggingTask) { setSettling(true); return; }
    // Keep the destination visible while the dropped task settles into its tray.
    const timer = setTimeout(() => setSettling(false), 240);
    return () => clearTimeout(timer);
  }, [props.draggingTask]);
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape') { setOpen(false); setSettling(false); } };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return <aside ref={dock} className={`availability-dock ${expanded ? 'expanded' : 'collapsed'}`} aria-label="Roommate availability dock" onClickCapture={event => {
    if (expanded) return;
    event.preventDefault(); event.stopPropagation(); setOpen(true); props.onManualOpen?.();
  }}>
    <div className="dock-heading"><button className="dock-toggle" aria-label={expanded ? 'Collapse availability' : 'Expand availability'} aria-expanded={expanded} aria-controls="availability-dock-trays" title={expanded ? 'Collapse availability' : 'Roommate availability'} onClick={() => setOpen(!expanded)} disabled={Boolean(props.draggingTask)}><Icon name={expanded ? 'close' : 'people'} size={expanded ? 12 : 17}/></button></div>
    <div id="availability-dock-trays" className="dock-trays"><AvailabilityTrays {...props} dockExpanded={expanded}/></div>
  </aside>;
}
