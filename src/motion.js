export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function animate(element, frames, options = {}) {
  if (!element?.animate || reduceMotion()) return Promise.resolve();
  return element.animate(frames, { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)', ...options }).finished.catch(() => {});
}

export function flash(element, className, duration = 650) {
  if (!element) return;
  element.classList.remove(className);
  // A fresh animation also provides feedback when the same target is used again.
  void element.offsetWidth;
  element.classList.add(className);
  setTimeout(() => element.classList.remove(className), duration);
}

export function taskFeedback(action, task) {
  requestAnimationFrame(() => {
    if (action === 'complete') {
      flash(document.querySelector(`[data-object="${CSS.escape(task.objectId)}"]`), 'task-completed');
    } else if (task.to && ['suggest', 'claim', 'accept'].includes(action)) {
      flash(document.querySelector(`[data-person="${CSS.escape(task.to)}"]`), 'drop-landed');
    }
  });
}

export function installButtonFeedback() {
  const active = new Set();
  function press(event) {
    if (reduceMotion() || (event.type === 'keydown' && (event.repeat || !['Enter', ' '].includes(event.key)))) return;
    const button = event.target.closest?.('button');
    if (!button || button.disabled || button.matches('.object-pin,.room-drag-surface,.resize-handle,.canvas-resize-handle,.room-delete,.profile-section-toggle')) return;
    // Navigation uses its own active indicator. An injected span also picks up
    // the icon-wrapper styles and becomes an extra row in the mobile tab bar.
    if (button.closest('.mobile-nav,.desktop-nav')) return;
    const rect = button.getBoundingClientRect();
    if (rect.width < 25 || rect.height < 25) return;
    const ink = document.createElement('span');
    ink.className = 'button-ink';
    ink.setAttribute('aria-hidden', 'true');
    const ripple = document.createElement('span');
    ripple.className = 'button-ripple';
    const diameter = Math.max(rect.width, rect.height) * 2;
    Object.assign(ripple.style, {
      width: `${diameter}px`, height: `${diameter}px`,
      left: `${event.type === 'keydown' ? rect.width / 2 : event.clientX - rect.left}px`,
      top: `${event.type === 'keydown' ? rect.height / 2 : event.clientY - rect.top}px`,
    });
    ink.append(ripple);
    button.append(ink);
    active.add(ink);
    animate(ripple, [{ transform: 'translate(-50%,-50%) scale(0)', opacity: .16 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 380 }).finally(() => { ink.remove(); active.delete(ink); });
  }
  document.addEventListener('pointerdown', press, true);
  document.addEventListener('keydown', press, true);
  return () => {
    document.removeEventListener('pointerdown', press, true);
    document.removeEventListener('keydown', press, true);
    active.forEach(ink => ink.remove());
  };
}
