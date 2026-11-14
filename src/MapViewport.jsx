import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { reduceMotion } from './motion';
import { layoutBounds } from './model';

let introSeenThisPage = false;
const MIN_ZOOM = .25;
const MAX_ZOOM = 3;
const ZOOM_SETTLE_MS = 420;
const ZOOM_COAST_MS = 240;
const fit = { x: 0, y: 0, zoom: 1 };

export default function MapViewport({ rooms, grid = layoutBounds(rooms), children, rearranging = false, revealRoomId = null }) {
  const viewport = useRef(null);
  const camera = useRef(null);
  const dots = useRef(null);
  const current = useRef(fit);
  const pointers = useRef(new Map());
  const editTouches = useRef(new Map());
  const editPinch = useRef(false);
  const gesture = useRef(null);
  const animation = useRef(null);
  const momentum = useRef(null);
  const wheelTarget = useRef(null);
  const releasedPinch = useRef(null);
  const suppressClick = useRef(false);
  const [view, setView] = useState(fit);
  const [touring, setTouring] = useState(false);
  const [panning, setPanning] = useState(false);
  const [gridSpan, setGridSpan] = useState({ x: 5, y: 5 });
  // Keep a stable world scale. Growing the editable area must not refit rooms.
  const frameGrid = useRef({ ...grid, cols: grid.cols - (grid.minX || 0), rows: grid.rows - (grid.minY || 0) }).current;
  const wrap = (value, period) => value - Math.floor((value + period / 2) / period) * period;

  function constrain(next, freePan = true) {
    const el = camera.current;
    const box = viewport.current;
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next.zoom));
    if (freePan) {
      const size = getComputedStyle(el);
      const width = parseFloat(size.width), height = parseFloat(size.height);
      const extentWidth = width * (grid.cols - (grid.minX || 0)) / frameGrid.cols;
      const extentHeight = height * (grid.rows - (grid.minY || 0)) / frameGrid.rows;
      const extentLeft = width * ((grid.minX || 0) - (frameGrid.minX || 0)) / frameGrid.cols;
      const extentTop = height * ((grid.minY || 0) - (frameGrid.minY || 0)) / frameGrid.rows;
      // One apartment exits completely before returning from the opposite edge.
      // Whole grid-cell periods keep the dot background aligned through the wrap.
      const cellX = width * zoom / frameGrid.cols, cellY = height * zoom / frameGrid.rows;
      const periodX = Math.ceil((box.clientWidth + extentWidth * zoom + 64) / cellX) * cellX;
      const periodY = Math.ceil((box.clientHeight + extentHeight * zoom + 64) / cellY) * cellY;
      const centerX = box.clientWidth / 2 - el.offsetLeft - width / 2 - (extentWidth - width) * zoom / 2 - extentLeft * zoom;
      const centerY = box.clientHeight / 2 - el.offsetTop - height / 2 - (extentHeight - height) * zoom / 2 - extentTop * zoom;
      return { zoom, x: wrap(next.x - centerX, periodX) + centerX, y: wrap(next.y - centerY, periodY) + centerY };
    }
    const padding = getComputedStyle(box);
    const width = box.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
    const height = box.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom);
    const maxX = freePan ? Math.max(0, (el.offsetWidth * zoom + width) / 2 - Math.min(96, el.offsetWidth * zoom * .3)) : Math.max(0, (el.offsetWidth * zoom - width) / 2);
    const maxY = freePan ? Math.max(0, (el.offsetHeight * zoom + height) / 2 - Math.min(96, el.offsetHeight * zoom * .3)) : Math.max(0, (el.offsetHeight * zoom - height) / 2);
    return { zoom, x: Math.max(-maxX, Math.min(maxX, next.x)), y: Math.max(-maxY, Math.min(maxY, next.y)) };
  }
  function anchorAt(x, y) {
    const rect = viewport.current.getBoundingClientRect();
    const el = camera.current;
    return { x: x - rect.left - el.offsetLeft - el.offsetWidth / 2, y: y - rect.top - el.offsetTop - el.offsetHeight / 2 };
  }
  const transform = v => `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
  function positionDots() {
    if (!dots.current || !camera.current || !viewport.current) return;
    const room = camera.current.getBoundingClientRect(), box = viewport.current.getBoundingClientRect();
    const cellX = room.width / frameGrid.cols, cellY = room.height / frameGrid.rows;
    // Show every second/fourth/etc. grid point as cells get smaller on screen.
    const stride = 2 ** Math.ceil(Math.log2(Math.max(1, 28 / Math.min(cellX, cellY))));
    const x = cellX * stride, y = cellY * stride;
    dots.current.dataset.stride = stride;
    dots.current.style.backgroundSize = `${x}px ${y}px`;
    dots.current.style.backgroundPosition = `${room.left - box.left - x / 2}px ${room.top - box.top - y / 2}px`;
  }
  function apply(next) {
    const value = constrain(next);
    current.current = value;
    camera.current.style.transform = transform(value);
    positionDots();
    setView(value);
    return value;
  }
  function stopMomentum() {
    cancelAnimationFrame(momentum.current);
    momentum.current = null;
    wheelTarget.current = null;
  }
  function glide(samples, releasedAt) {
    if (reduceMotion() || samples.length < 2 || releasedAt - samples.at(-1).time > 80) return;
    const first = samples[0], last = samples.at(-1);
    const elapsed = last.time - first.time;
    if (elapsed < 8) return;
    let vx = (last.x - first.x) / elapsed;
    let vy = (last.y - first.y) / elapsed;
    const speed = Math.hypot(vx, vy);
    if (speed < .05) return;
    // Cap flick speed, then decay smoothly independent of the display refresh rate.
    const limit = Math.min(1, 1.8 / speed);
    vx *= limit;
    vy *= limit;
    let previous = performance.now();
    const tick = now => {
      const dt = now - previous;
      previous = now;
      const decay = Math.exp(-dt / 220);
      const before = current.current;
      const next = apply({ ...before, x: before.x + vx * 220 * (1 - decay), y: before.y + vy * 220 * (1 - decay) });
      vx = Math.abs(next.x - before.x) < .001 ? 0 : vx * decay;
      vy = Math.abs(next.y - before.y) < .001 ? 0 : vy * decay;
      if (Math.hypot(vx, vy) > .02) momentum.current = requestAnimationFrame(tick);
      else momentum.current = null;
    };
    momentum.current = requestAnimationFrame(tick);
  }
  function panGesture(x, y, time, moved = false) {
    const view = { ...current.current };
    return { type: 'pan', x, y, view, moved, samples: [{ x: view.x, y: view.y, time }] };
  }
  function stopTour() {
    stopMomentum();
    if (!animation.current) return;
    introSeenThisPage = true;
    animation.current.cancel();
    animation.current = null;
    setTouring(false);
    apply(fit);
  }
  function zoomTo(zoom, anchor = { x: 0, y: 0 }) {
    stopTour();
    const old = current.current;
    const target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    const update = value => {
      const ratio = value / old.zoom;
      apply({ zoom: value, x: anchor.x - (anchor.x - old.x) * ratio, y: anchor.y - (anchor.y - old.y) * ratio });
    };
    if (reduceMotion()) { update(target); return; }
    wheelTarget.current = target;
    const started = performance.now(), from = Math.log(old.zoom), change = Math.log(target) - from;
    const tick = now => {
      const progress = Math.min(1, (now - started) / ZOOM_SETTLE_MS);
      update(progress === 1 ? target : Math.exp(from + change * (1 - (1 - progress) ** 3)));
      if (progress < 1) momentum.current = requestAnimationFrame(tick);
      else { momentum.current = null; wheelTarget.current = null; }
    };
    momentum.current = requestAnimationFrame(tick);
  }
  function zoomGlide(pinch, releasedAt) {
    const samples = pinch.samples;
    if (reduceMotion() || !samples || samples.length < 2 || releasedAt - samples.at(-1).time > 90) return;
    const first = samples[0], last = samples.at(-1), elapsed = last.time - first.time;
    if (elapsed < 8) return;
    let velocity = Math.max(-.0013, Math.min(.0013, (last.value - first.value) / elapsed));
    if (Math.abs(velocity) < .00003) return;
    const anchor = pinch.lastAnchor || pinch.anchor;
    let previous = performance.now();
    const tick = now => {
      const decay = Math.exp(-(now - previous) / ZOOM_COAST_MS); previous = now;
      const old = current.current;
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, old.zoom * Math.exp(velocity * ZOOM_COAST_MS * (1 - decay))));
      const ratio = zoom / old.zoom;
      apply({ zoom, x: anchor.x - (anchor.x - old.x) * ratio, y: anchor.y - (anchor.y - old.y) * ratio });
      velocity *= decay;
      if (Math.abs(velocity) > .00003 && zoom > MIN_ZOOM && zoom < MAX_ZOOM) momentum.current = requestAnimationFrame(tick);
      else momentum.current = null;
    };
    momentum.current = requestAnimationFrame(tick);
  }

  useLayoutEffect(() => {
    positionDots();
    editTouches.current.clear(); editPinch.current = false;
    pointers.current.clear(); gesture.current = null;
    releasedPinch.current = null;
    stopTour(); setPanning(false);
  }, [rearranging]);

  useLayoutEffect(() => {
    if (!revealRoomId) return;
    const room = [...camera.current.querySelectorAll('.map-room')].find(el => el.dataset.room === revealRoomId);
    if (!room) return;
    stopTour();
    const box = viewport.current, rect = box.getBoundingClientRect(), padding = getComputedStyle(box);
    const bounds = room.getBoundingClientRect();
    const left = rect.left + parseFloat(padding.paddingLeft) + 8, right = rect.right - parseFloat(padding.paddingRight) - 8;
    const top = rect.top + parseFloat(padding.paddingTop) + 8, bottom = rect.bottom - parseFloat(padding.paddingBottom) - 8;
    const dx = bounds.width > right - left ? (left + right - bounds.left - bounds.right) / 2 : bounds.left < left ? left - bounds.left : bounds.right > right ? right - bounds.right : 0;
    const dy = bounds.height > bottom - top ? (top + bottom - bounds.top - bounds.bottom) / 2 : bounds.top < top ? top - bounds.top : bounds.bottom > bottom ? bottom - bounds.bottom : 0;
    apply({ ...current.current, x: current.current.x + dx, y: current.current.y + dy });
  }, [revealRoomId]);

  useLayoutEffect(() => {
    if (introSeenThisPage || window.__ROOMIE_SKIP_MAP_INTRO__ || reduceMotion() || !rooms.length || !camera.current.animate) return;
    const blocks = [...camera.current.querySelectorAll('.map-room')].sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top) || parseFloat(a.style.left) - parseFloat(b.style.left));
    const styles = blocks.map(el => ({ visibility: el.style.visibility, origin: el.style.transformOrigin, willChange: el.style.willChange }));
    let animations = [];
    let artworkTimer, finishTimer;
    let frame = 0;
    let cancelled = false;
    const reveal = () => blocks.forEach((el, index) => {
      el.style.visibility = styles[index].visibility;
      el.style.transformOrigin = styles[index].origin;
      el.style.willChange = styles[index].willChange;
    });
    const arrival = { cancel() {
      cancelled = true;
      clearTimeout(artworkTimer);
      clearTimeout(finishTimer);
      cancelAnimationFrame(frame);
      animations.forEach(animation => animation.cancel());
      reveal();
    } };
    animation.current = arrival;
    setTouring(true);
    // Hide rooms before the first paint, including while their artwork decodes.
    // The animation's backwards fill keeps delayed rooms hidden until their turn.
    blocks.forEach(el => { el.style.visibility = 'hidden'; });
    const interrupt = () => { if (animation.current) { introSeenThisPage = true; stopTour(); } };
    const escape = event => {
      if (event.key === 'Escape' || (event.target === viewport.current && ['Home', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))) interrupt();
    };
    const finish = () => {
      if (cancelled || animation.current !== arrival) return;
      clearTimeout(finishTimer);
      introSeenThisPage = true;
      animation.current = null;
      animations.forEach(item => item.cancel());
      reveal(); setTouring(false);
    };
    const start = () => {
      if (cancelled) return;
      const stagger = Math.min(180, 900 / Math.max(1, blocks.length - 1));
      const height = Math.min(140, Math.max(90, viewport.current.clientHeight * .15));
      animations = blocks.map((el, index) => {
        el.style.visibility = styles[index].visibility;
        el.style.transformOrigin = '50% 100%';
        el.style.willChange = 'transform, opacity';
        return el.animate([
          { opacity: 0, transform: `translateY(${-height}px) scale(.96)`, offset: 0, easing: 'ease-in' },
          { opacity: 1, transform: `translateY(${-height * .85}px) scale(.98)`, offset: .18, easing: 'cubic-bezier(.45,0,1,1)' },
          { opacity: 1, transform: 'translateY(3px) scale(1.025,.975)', offset: .7, easing: 'cubic-bezier(.15,.8,.3,1)' },
          { opacity: 1, transform: 'translateY(-5px) scale(.99,1.01)', offset: .86, easing: 'ease-in' },
          { opacity: 1, transform: 'translateY(0) scale(1)', offset: 1 },
        ], { duration: 600, delay: index * stagger, fill: 'both' });
      });
      // A browser-cancelled animation must reveal every room, including those
      // whose delayed first frame still has zero opacity.
      finishTimer = setTimeout(finish, 600 + Math.max(0, blocks.length - 1) * stagger + 500);
      Promise.all(animations.map(animation => animation.finished)).then(finish, finish);
    };
    document.addEventListener('pointerdown', interrupt, true);
    document.addEventListener('keydown', escape, true);
    document.addEventListener('wheel', interrupt, { passive: true, capture: true });
    const artwork = [...camera.current.querySelectorAll('img')];
    Promise.race([
      Promise.all(artwork.map(img => img.decode().catch(() => {}))),
      new Promise(resolve => { artworkTimer = setTimeout(resolve, 1800); }),
    ]).then(() => {
      clearTimeout(artworkTimer);
      if (!cancelled) frame = requestAnimationFrame(start);
    });
    return () => {
      arrival.cancel();
      if (animation.current === arrival) animation.current = null;
      document.removeEventListener('pointerdown', interrupt, true);
      document.removeEventListener('keydown', escape, true);
      document.removeEventListener('wheel', interrupt, true);
    };
  }, []);

  useEffect(() => {
    const box = viewport.current;
    function wheel(e) {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) zoomTo((wheelTarget.current ?? current.current.zoom) * Math.exp(-e.deltaY * .007), anchorAt(e.clientX, e.clientY));
      else {
        stopTour();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? box.clientHeight : 1;
        apply({ ...current.current, x: current.current.x - e.deltaX * unit, y: current.current.y - e.deltaY * unit });
      }
    }
    const preventPinchScroll = e => { if (e.touches.length > 1) e.preventDefault(); };
    box.addEventListener('wheel', wheel, { passive: false });
    box.addEventListener('touchstart', preventPinchScroll, { passive: false });
    box.addEventListener('touchmove', preventPinchScroll, { passive: false });
    const observer = new ResizeObserver(() => {
      const el = camera.current;
      const x = Math.max(5, 2 * Math.ceil(box.clientWidth / Math.max(1, el.offsetWidth * MIN_ZOOM) + (grid.cols - (grid.minX || 0)) / frameGrid.cols) + 3);
      const y = Math.max(5, 2 * Math.ceil(box.clientHeight / Math.max(1, el.offsetHeight * MIN_ZOOM) + (grid.rows - (grid.minY || 0)) / frameGrid.rows) + 3);
      setGridSpan(previous => previous.x === x && previous.y === y ? previous : { x, y });
      if (!animation.current) apply(current.current);
      else positionDots();
    });
    observer.observe(box);
    observer.observe(camera.current);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionChanged = () => { if (media.matches) stopTour(); };
    media.addEventListener('change', motionChanged);
    return () => {
      stopMomentum();
      box.removeEventListener('wheel', wheel);
      box.removeEventListener('touchstart', preventPinchScroll);
      box.removeEventListener('touchmove', preventPinchScroll);
      observer.disconnect();
      media.removeEventListener('change', motionChanged);
    };
  }, [grid.cols, grid.rows, grid.minX, grid.minY]);


  function begin(e) {
    if (e.button !== 0) return;
    stopTour();
    releasedPinch.current = null;
    suppressClick.current = false;
    const object = e.target.closest('.object-pin,.supply-map-pin');
    if (object && e.pointerType !== 'touch') return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, object });
    if (object && pointers.current.size === 1) { gesture.current = null; return; }
    suppressClick.current = false;
    if (pointers.current.size === 2) {
      // A second finger turns an object gesture into a canvas pinch.
      for (const [id, point] of pointers.current) {
        point.object?.dispatchEvent(new PointerEvent('pointercancel', { pointerId: id, bubbles: false }));
        viewport.current.setPointerCapture(id);
      }
      const [a, b] = [...pointers.current.values()];
      gesture.current = { type: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y), view: { ...current.current }, anchor: anchorAt((a.x + b.x) / 2, (a.y + b.y) / 2), samples: [{ value: Math.log(current.current.zoom), time: e.timeStamp }] };
      suppressClick.current = true;
    } else gesture.current = panGesture(e.clientX, e.clientY, e.timeStamp);
    // Capture after movement so a simple tap can still open a room.
    if (pointers.current.size > 1) viewport.current.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { ...pointers.current.get(e.pointerId), x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pinch' && pointers.current.size >= 2) {

      const [a, b] = [...pointers.current.values()];
      const center = anchorAt((a.x + b.x) / 2, (a.y + b.y) / 2);
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, g.view.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(g.distance, 1)));
      const ratio = zoom / g.view.zoom;
      apply({ zoom, x: center.x - (g.anchor.x - g.view.x) * ratio, y: center.y - (g.anchor.y - g.view.y) * ratio });
      g.lastAnchor = center;
      g.samples.push({ value: Math.log(zoom), time: e.timeStamp });
      while (g.samples.length > 2 && g.samples[0].time < e.timeStamp - 80) g.samples.shift();
      suppressClick.current = true;
    } else if (g.type === 'pan') {
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (Math.hypot(dx, dy) < 5 && !g.moved) return;
      releasedPinch.current = null;
      viewport.current.setPointerCapture(e.pointerId);
      g.moved = true;

      suppressClick.current = true;
      setPanning(true);
      const value = { ...g.view, x: g.view.x + dx, y: g.view.y + dy };
      apply(value);
      // Velocity stays continuous as the apartment wraps to the opposite edge.
      g.samples.push({ x: value.x, y: value.y, time: e.timeStamp });
      while (g.samples.length > 2 && g.samples[0].time < e.timeStamp - 100) g.samples.shift();
    }
  }
  function end(e) {
    if (!pointers.current.has(e.pointerId)) return;
    const ended = gesture.current;
    if (e.type === 'pointercancel') releasedPinch.current = null;
    else if (ended?.type === 'pinch') releasedPinch.current = ended;
    pointers.current.delete(e.pointerId);
    if (viewport.current.hasPointerCapture(e.pointerId)) viewport.current.releasePointerCapture(e.pointerId);
    if (pointers.current.size === 1) {
      const [point] = [...pointers.current.values()];
      gesture.current = panGesture(point.x, point.y, e.timeStamp, true);
    } else gesture.current = null;
    setPanning(false);
    if (!pointers.current.size && e.type !== 'pointercancel') {
      if (releasedPinch.current) { zoomGlide(releasedPinch.current, e.timeStamp); releasedPinch.current = null; }
      else if (ended?.type === 'pan' && ended.moved) glide(ended.samples, e.timeStamp);
    }
  }

  function editTouchStart(e) {
    if (rearranging) stopTour();
    if (!rearranging || e.pointerType !== 'touch') return;
    editTouches.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY, target: e.target });
    if (editTouches.current.size !== 2) return;
    e.preventDefault(); e.stopPropagation(); stopTour();
    const points = [...editTouches.current.values()];
    // A second finger cancels room movement/resizing and takes over the camera.
    for (const point of points) point.target.dispatchEvent(new PointerEvent('pointercancel', { pointerId: point.id, pointerType: 'touch', bubbles: true }));
    editTouches.current = new Map(points.map(point => [point.id, point]));
    editPinch.current = true; pointers.current.clear();
    for (const point of points) {
      pointers.current.set(point.id, { x: point.x, y: point.y });
      viewport.current.setPointerCapture(point.id);
    }
    const [a, b] = points;
    releasedPinch.current = null;
    gesture.current = { type: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y), view: { ...current.current }, anchor: anchorAt((a.x + b.x) / 2, (a.y + b.y) / 2), samples: [{ value: Math.log(current.current.zoom), time: e.timeStamp }] };
    suppressClick.current = true; setPanning(false);
  }
  function editTouchMove(e) {
    if (!rearranging || e.pointerType !== 'touch') return;
    const point = editTouches.current.get(e.pointerId);
    if (point) { point.x = e.clientX; point.y = e.clientY; }
    if (editPinch.current) { e.preventDefault(); e.stopPropagation(); move(e); }
  }
  function editTouchEnd(e) {
    if (!rearranging || e.pointerType !== 'touch') return;
    editTouches.current.delete(e.pointerId);
    if (editPinch.current) {
      e.stopPropagation(); end(e);
      if (!editTouches.current.size) editPinch.current = false;
    }
  }

  return <div ref={viewport} role="region" aria-label="Apartment canvas" aria-describedby="canvas-gesture-help" tabIndex={0} onPointerDownCapture={editTouchStart} onPointerMoveCapture={editTouchMove} onPointerUpCapture={editTouchEnd} onPointerCancelCapture={editTouchEnd} onKeyDown={e => {
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey) return;
    const delta = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
    if (delta) {
      e.preventDefault(); stopTour();
      apply({ ...current.current, x: current.current.x + delta[0], y: current.current.y + delta[1] });
    } else if (e.key === 'Home' || e.key === '0') { e.preventDefault(); stopTour(); apply(fit); }
  }} className={`map-wrap map-viewport ${view.zoom !== 1 ? 'is-zoomed' : ''} ${panning ? 'is-panning' : ''}`} data-intro={touring ? 'playing' : 'complete'} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onClickCapture={e => {
    if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; }
  }}>
    <span className="sr-only" id="canvas-gesture-help">Drag a room or the background to move the canvas. Moving the apartment fully past an edge brings it back on the opposite side. Pinch with two fingers to zoom. Drag task icons onto roommates to assign them. With the canvas focused, use arrow keys to pan and Home to show all rooms.</span>
    <div ref={dots} className="canvas-dots" aria-hidden="true"/>
    <div className="map-camera" ref={camera} style={{ '--grid-cols': frameGrid.cols, '--grid-rows': frameGrid.rows, aspectRatio: `${frameGrid.cols} / ${frameGrid.rows}` }}>
      <div className="canvas-grid" aria-hidden="true" style={{ '--grid-tiles-x': frameGrid.cols * gridSpan.x, '--grid-tiles-y': frameGrid.rows * gridSpan.y, '--grid-left': `${-(gridSpan.x - 1) * 50}%`, '--grid-top': `${-(gridSpan.y - 1) * 50}%`, '--grid-width': `${gridSpan.x * 100}%`, '--grid-height': `${gridSpan.y * 100}%` }}/>
      {React.Children.map(children, child => React.isValidElement(child) ? React.cloneElement(child, { frameGrid }) : child)}
    </div>

  </div>;
}
