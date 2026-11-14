import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icons';
import { OBJECT_TYPES } from './model';
import { reduceMotion } from './motion';
import { canReceiveTask } from './availability';

function pointOnCurve(points, t) {
  const [a, b, c, d] = points, u = 1 - t;
  return { x: u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * d.x, y: u ** 3 * a.y + 3 * u ** 2 * t * b.y + 3 * u * t ** 2 * c.y + t ** 3 * d.y };
}

// This is a visual demonstration only. It never dispatches drag/drop events or
// changes a task, roommate, camera, or the user's saved focus setting.
export default function DockDragHint({ run, state, disabled, onActive }) {
  const consumed = useRef(0), ghost = useRef(null), latestState = useRef(state), activeRun = useRef(null);
  const [hint, setHint] = useState(null);
  useLayoutEffect(() => {
    latestState.current = state;
    const active = activeRun.current;
    if (active?.source && (!active.source.isConnected || !state.tasks.some(task => task.objectId === active.source.dataset.object && task.status === 'open') || !canReceiveTask(state.people.find(person => person.id === active.target.closest('[data-person]')?.dataset.person)))) active.stop();
  }, [state]);
  useEffect(() => {
    if (!run || consumed.current === run) return;
    if (disabled) { consumed.current = run; return; }
    let stopped = false, timer, frame, source, target;
    // Consume only a completed or deliberately dismissed hint. React's local
    // refresh and StrictMode may clean up/restart this effect before it shows.
    const dismiss = () => { consumed.current = run; stop(); };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      activeRun.current = null;
      clearTimeout(timer); cancelAnimationFrame(frame);
      source?.classList.remove('task-hint-source');
      target?.classList.remove('task-hint-target');
      setHint(null); onActive(false);
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', dismiss, true);
      window.removeEventListener('wheel', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', dismiss, true);
    window.addEventListener('wheel', dismiss, { capture: true, passive: true });
    window.addEventListener('resize', dismiss);
    async function start() {
      const dock = document.querySelector('.availability-dock.expanded');
      if (!dock) { dismiss(); return; }
      // Measure the final tray positions after the dock's own expansion settles.
      await Promise.allSettled(dock.getAnimations().map(animation => animation.finished));
      if (stopped || !dock.classList.contains('expanded')) return;
      const snapshot = latestState.current;
      const draggableObjects = new Set(snapshot.tasks.filter(task => task.status === 'open').map(task => task.objectId));
      const headerBottom = document.querySelector('.app-header')?.getBoundingClientRect().bottom || 0;
      const dockBox = dock.getBoundingClientRect();
      const candidates = [...document.querySelectorAll('.map-page .object-pin[data-object]')].filter(element => draggableObjects.has(element.dataset.object) && element.getBoundingClientRect().width > 0);
      source = candidates.find(element => {
        const box = element.getBoundingClientRect();
        return box.left >= 8 && box.right <= innerWidth - 8 && box.top >= headerBottom + 8 && box.bottom <= innerHeight - 90
          && !(box.left < dockBox.right && box.right > dockBox.left && box.top < dockBox.bottom && box.bottom > dockBox.top);
      });
      const slots = [...dock.querySelectorAll('[data-person]:not([data-self="true"]):not([data-drop-disabled="true"]) .tray-slot'), ...dock.querySelectorAll('[data-self="true"]:not([data-drop-disabled="true"]) .tray-slot')];
      target = slots.find(slot => {
        const box = slot.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.top >= dockBox.top && box.bottom <= dockBox.bottom && box.top >= 0 && box.bottom <= innerHeight;
      });
      if (!source || !target) { dismiss(); return; }
      activeRun.current = { source, target, stop: dismiss };
      onActive(true);
      frame = requestAnimationFrame(() => {
        if (stopped) return;
        source.classList.add('task-hint-source'); target.classList.add('task-hint-target');
        const from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
        const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
        const d = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
        const dx = d.x - a.x, dy = d.y - a.y, length = Math.max(1, Math.hypot(dx, dy)), bend = Math.min(50, length * .15);
        const control = fraction => ({ x: Math.max(16, Math.min(innerWidth - 16, a.x + dx * fraction - dy / length * bend)), y: Math.max(headerBottom + 8, Math.min(innerHeight - 90, a.y + dy * fraction + dx / length * bend)) });
        const object = latestState.current.objects.find(object => object.id === source.dataset.object);
        const appearance = getComputedStyle(source);
        setHint({ points: [a, control(.3), control(.7), d], size: Math.min(56, Math.max(20, from.width)), icon: OBJECT_TYPES[object?.type]?.icon || 'requests', fill: appearance.backgroundColor, border: appearance.borderTopColor, color: appearance.color, motion: !reduceMotion() });
        timer = setTimeout(dismiss, reduceMotion() ? 2300 : 3200);
      });
    }
    start();
    return stop;
  }, [run, disabled, onActive]);

  useLayoutEffect(() => {
    if (!hint?.motion || !ghost.current) return;
    const frames = Array.from({ length: 21 }, (_, index) => {
      const t = index / 20, point = pointOnCurve(hint.points, t);
      return { transform: `translate(${point.x - hint.size / 2}px, ${point.y - hint.size / 2}px) scale(.92)`, opacity: index === 0 ? 0 : index > 17 ? (20 - index) / 3 : 1, offset: t };
    });
    const animation = ghost.current.animate(frames, { duration: 1900, delay: 250, easing: 'cubic-bezier(.35,0,.25,1)', fill: 'both' });
    return () => animation.cancel();
  }, [hint]);
  if (!hint?.motion) return null;
  const [a, b, c, d] = hint.points;
  return createPortal(<div className="dock-drag-hint" aria-hidden="true">
    <svg className="task-hint-path"><path d={`M ${a.x} ${a.y} C ${b.x} ${b.y}, ${c.x} ${c.y}, ${d.x} ${d.y}`}/></svg>
    <div ref={ghost} className="task-hint-ghost" style={{ width: hint.size, height: hint.size, background: hint.fill, borderColor: hint.border, color: hint.color }}><Icon name={hint.icon} size={hint.size * .5}/><span className="task-hint-hand"><Icon name="drag" size={14}/></span></div>
  </div>, document.body);
}
