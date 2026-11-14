import React, { useEffect, useRef, useState } from 'react';

export default function LoadingScreen({ complete = false, startedAt }) {
  const started = useRef(startedAt ?? performance.now()).current;
  const readProgress = () => Math.min(94, 4 + Math.floor(Math.max(0, performance.now() - started) / 250) * 4.5);
  const [progress, setProgress] = useState(readProgress);
  useEffect(() => {
    if (complete) return;
    const update = () => setProgress(readProgress());
    const timer = setInterval(update, 125);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [started, complete]);
  const value = complete ? 100 : progress;
  return <main className={`nest-loading${complete ? ' is-complete' : ''}`} data-complete={complete} aria-busy={!complete}>
    <div className="nest-loading-content">
      <img className="nest-loading-label" src="/loading-text.svg" width="118" height="14" alt="loading..."/>
      <div className="nest-loading-track" role="progressbar" aria-label="Loading nest" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <span className="nest-loading-fill" style={{ clipPath: complete ? 'inset(0px)' : `inset(0 ${100 - value}% 0 0)` }}/>
      </div>
    </div>
  </main>;
}

export function LoadingGate({ children, startedAt, bypass = false }) {
  const skip = Boolean(window.__NEST_SKIP_LOADING__) || bypass;
  const started = useRef(startedAt ?? performance.now()).current;
  const [complete, setComplete] = useState(skip);
  const [revealed, setRevealed] = useState(skip);
  useEffect(() => {
    if (skip) return;
    const timer = setTimeout(() => setComplete(true), Math.max(0, 5000 - (performance.now() - started)));
    return () => clearTimeout(timer);
  }, [skip, started]);
  useEffect(() => {
    if (!complete || skip) return;
    // Let the full bar reach the screen before starting its final hold. Safari
    // can suspend painting in a background tab while timers continue to advance.
    let firstFrame, secondFrame, timer;
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => { timer = setTimeout(() => setRevealed(true), 400); });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); clearTimeout(timer); };
  }, [complete, skip]);
  return revealed || bypass ? children : <LoadingScreen complete={complete} startedAt={started}/>;
}
