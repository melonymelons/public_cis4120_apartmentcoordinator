import React, { useLayoutEffect, useRef } from 'react';

import { drawRoomScene, drawHallwayScene, drawCustomScene, drawLaundryScene, roomArtBounds } from './roomScene';

// Limit mobile backing-store memory; these scenes intentionally use crisp pixels.
function canvasContext(output, ratioLimit = 2) {
  const width = output.clientWidth, height = output.clientHeight;
  if (!width || !height) return null;
  const ratio = Math.min(window.devicePixelRatio || 1, ratioLimit, 4096 / width, 4096 / height, Math.sqrt(2097152 / (width * height)));
  const pixelWidth = Math.max(1, Math.round(width * ratio)), pixelHeight = Math.max(1, Math.round(height * ratio));
  if (output.width !== pixelWidth) output.width = pixelWidth;
  if (output.height !== pixelHeight) output.height = pixelHeight;
  const ctx = output.getContext('2d');
  if (!ctx || ctx.isContextLost?.()) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, output.width, output.height);
  ctx.imageSmoothingEnabled = false;
  return { ctx, ratio, width, height };
}

function observePainting(output, paint) {
  let frame;
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint); };
  const resized = new ResizeObserver(schedule); resized.observe(output);
  const visible = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) schedule(); }); visible.observe(output);
  const lost = event => { event.preventDefault(); delete output.dataset.painted; };
  output.addEventListener('contextlost', lost);
  output.addEventListener('contextrestored', schedule);
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pageshow', schedule);
  schedule();
  return { schedule, dispose() {
    cancelAnimationFrame(frame); resized.disconnect(); visible.disconnect();
    output.removeEventListener('contextlost', lost); output.removeEventListener('contextrestored', schedule);
    document.removeEventListener('visibilitychange', schedule); window.removeEventListener('pageshow', schedule);
  } };
}

export default function RoomArtwork({ artwork, type }) {
  const image = useRef(null), canvas = useRef(null);
  useLayoutEffect(() => {
    const img = image.current, output = canvas.current;
    let disposed = false, decoded = false, decodeTimer;
    delete output.dataset.painted;
    function paint() {
      if (!decoded || !img.complete || !img.naturalWidth) return;
      const surface = canvasContext(output);
      if (!surface) return;
      const { ctx, ratio, width: logicalWidth, height: logicalHeight } = surface;
      const bounds = roomArtBounds(img, artwork);
      const scale = Math.min(logicalWidth / bounds.width, logicalHeight / bounds.height);
      ctx.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
      output.dataset.furnishings = drawRoomScene(ctx, img, artwork, logicalWidth / scale, logicalHeight / scale);
      output.dataset.painted = 'true';
    }
    const observer = observePainting(output, paint);
    const ready = () => {
      clearTimeout(decodeTimer);
      if (disposed) return;
      decoded = true; observer.schedule();
    };
    const load = () => {
      if (!img.complete || !img.naturalWidth) return;
      decoded = false;
      clearTimeout(decodeTimer);
      // A load event can precede usable decoded pixels on Safari. Never cache
      // a blank source image, and don't let a stalled decode hide the room.
      decodeTimer = setTimeout(ready, 1800);
      if (img.decode) img.decode().then(ready, ready); else ready();
    };
    img.addEventListener('load', load); load();
    return () => { disposed = true; clearTimeout(decodeTimer); img.removeEventListener('load', load); observer.dispose(); };
  }, [artwork]);
  return <>
    <img ref={image} className={`furniture furniture-${type} pixel-room-art pixel-room-source`} src={`/pixel/${artwork}.webp`} alt="" aria-hidden="true" draggable={false} decoding="async"/>
    <canvas ref={canvas} className={`furniture furniture-${type} pixel-room-scene`} aria-hidden="true"/>
  </>;
}

export function ProceduralRoomArtwork({ type }) {
  const canvas = useRef(null);
  useLayoutEffect(() => {
    const output = canvas.current;
    function paint() {
      const surface = canvasContext(output);
      if (!surface) return;
      const { ctx, ratio, width, height } = surface;
      const scale = Math.min(width / 320, height / 240);
      ctx.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
      const draw = { hallway: drawHallwayScene, laundry: drawLaundryScene, custom: drawCustomScene }[type];
      draw(ctx, width / scale, height / scale);
      output.dataset.painted = 'true';
    }
    const observer = observePainting(output, paint);
    return observer.dispose;
  }, [type]);
  return <canvas ref={canvas} className={`furniture furniture-${type} pixel-room-art pixel-room-scene`} aria-hidden="true"/>;
}
