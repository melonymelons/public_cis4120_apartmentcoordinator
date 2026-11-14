import React from 'react';

export function DemoDiamond() {
  return <span className="demo-diamond" aria-hidden="true"><svg width="14" height="17" viewBox="0 0 16 20" fill="none"><path d="M8 1 15 8 8 19 1 8Z" fill="#bde4f5" stroke="#6f9cba" strokeWidth="1.2"/><path d="m1 8 7-3 7 3M8 1v4m0 0L5 8l3 11 3-11-3-3ZM1 8h14" stroke="#6f9cba" strokeWidth=".8"/><path d="m8 2-4 5 4-2Z" fill="#effbff"/></svg><span className="diamond-glint first"/><span className="diamond-glint second"/></span>;
}

export default function Brand({ onHome }) {
  return <div className="header-brand"><a className="brand" href="#" onClick={onHome}><span className="brand-mark"><img src="/icon.svg" width="26" height="26" alt=""/></span>nest.</a><a className="hello-diamond" href="#hello" aria-label="Open Hello world and style guide" title="Hello world & styles"><DemoDiamond/></a></div>;
}
