import React, { useLayoutEffect, useRef, useState } from 'react';
import Brand, { DemoDiamond } from './Brand';
import Icon, { ICON_NAMES } from './Icons';
import { ROOM_TYPES } from './model';
import { AVATAR_COLORS } from './household';
import { Character, CHARACTERS } from './Avatar';
import './hello.css';

const palette = [
  ['Text', 'var(--ink)', '#654A3A'], ['Secondary text', 'var(--muted)', '#927762'],
  ['Green', 'var(--green)', '#557853'], ['Accent', 'var(--orange)', '#C97765'],
  ['Borders', 'var(--line)', '#DCC6A9'], ['Paper', 'var(--paper)', '#FFF6E5'],
  ['Focus ring', 'var(--focus-ring)', '#B9859E'], ['Pixel ink', 'var(--pixel-ink)', '#78553D'],
  ['Cream', 'var(--pixel-cream)', '#FFF3D9'], ['Pink', 'var(--pixel-pink)', '#EDB8C7'],
  ['Page background', '#f2e2d2', '#F2E2D2'], ['Apartment background', '#e3e8d7', '#E3E8D7'],
  ['Primary button', '#eabb8d', '#EABB8D'], ['Attention task', '#f0b6c3', '#F0B6C3'],
  ['Open task', '#ffe4a2', '#FFE4A2'], ['Assigned task', '#cdddaf', '#CDDDAF'],
  ['Suggested task', '#f0d6a0', '#F0D6A0'],
  ...Object.values(ROOM_TYPES).map(room => [`${room.label} tint`, room.color, room.color.toUpperCase()]),
  ['Loading bar', '#dca1b0', '#DCA1B0'], ['Flower petals', '#e99bab', '#E99BAB'],
  ['Flower center', '#f7dfa0', '#F7DFA0'],
  ['Diamond', '#bde4f5', '#BDE4F5'], ['Diamond outline', '#6f9cba', '#6F9CBA'],
  ['Diamond highlight', '#effbff', '#EFFBFF'], ['Diamond sparkle', '#8cb8d3', '#8CB8D3'],
];

function HelloWorld() { return <p className="hello-world-output">Hello world</p>; }

const sectionIds = ['world', 'fonts', 'palette', 'avatars', 'icons', 'graphics', 'characters'];
function GuideSection({ id, title, open, onToggle, children, primary = false }) {
  const Heading = primary ? 'h2' : 'h3';
  return <details className="hello-detail" open={open} onToggle={event => onToggle(id, event.currentTarget.open)}><summary><Heading>{title}</Heading><Icon name="down" size={18}/></summary><div className="hello-detail-content">{children}</div></details>;
}

export default function HelloPage() {
  const title = useRef(null);
  const [sections, setSections] = useState({ world: true, fonts: true });
  const toggle = (id, open) => setSections(previous => Boolean(previous[id]) === open ? previous : { ...previous, [id]: open });
  const section = (id, label, children, primary = false) => <GuideSection id={id} title={label} open={Boolean(sections[id])} onToggle={toggle} primary={primary}>{children}</GuideSection>;
  useLayoutEffect(() => {
    const oldTitle = document.title, overflow = document.body.style.overflow;
    document.title = 'Hello world & styles — nest.';
    document.body.style.overflow = 'hidden';
    title.current?.focus({ preventScroll: true });
    return () => { document.title = oldTitle; document.body.style.overflow = overflow; };
  }, []);
  return <main className="hello-page" aria-labelledby="hello-page-title">
    <header className="app-header hello-page-header"><div className="header-inner"><Brand/><a className="button subtle small-button hello-back" href="#"><Icon name="arrow" size={15}/>Back to nest.</a></div></header>
    <div className="hello-page-inner">
      <h1 id="hello-page-title" ref={title} tabIndex={-1}>Hello, nest.</h1>
      <p className="hello-page-intro">A working demonstration of our technology and visual style.</p>
      <div className="hello-section-tools" role="group" aria-label="Showcase sections"><button className="button subtle small-button" onClick={() => setSections(Object.fromEntries(sectionIds.map(id => [id, true])))}>Expand all</button><button className="button subtle small-button" onClick={() => setSections({})}>Collapse all</button></div>
      {section('world', 'Hello world', <><p>JavaScript + React · Built with Vite</p><div className="hello-world-demo"><HelloWorld/></div><p className="hello-caption">Rendered by a simple React component: <code>{'<p>Hello world</p>'}</code></p></>, true)}
      <section className="hello-section" aria-labelledby="hello-styles-title"><h2 id="hello-styles-title">Hello styles</h2><p>Tap a section to explore the app’s CSS and Pixelarticons components.</p>
        {section('fonts', 'Fonts', <div className="hello-fonts"><article><span className="hello-caption">Karla · Headings & titles</span><p className="hello-karla">A little place to call home.</p><p className="hello-karla hello-font-alphabet">Aa Bb Cc · 0123456789</p></article><article><span className="hello-caption">Inter · Body, buttons & fields</span><p className="hello-inter">Share a home. Make room for each other.</p><p className="hello-inter hello-font-alphabet">Aa Bb Cc · 0123456789</p></article></div>)}
        {section('palette', 'Color palette', <div className="hello-colors">{palette.map(([name, color, hex]) => <figure key={name}><span className="hello-swatch" style={{ background: color }}/><figcaption><strong>{name}</strong><code>{hex}</code></figcaption></figure>)}</div>)}
        {section('avatars', 'Avatar colors', <div className="hello-colors">{AVATAR_COLORS.map(({ name, value }) => <figure key={name}><span className="hello-swatch" style={{ background: value }}/><figcaption><strong>{name}</strong><code>{value.toUpperCase()}</code></figcaption></figure>)}</div>)}
        {section('icons', 'Icons', <ul className="hello-icons">{ICON_NAMES.map(name => <li key={name}><Icon name={name} size={24}/><span>{name}</span></li>)}</ul>)}
        {section('graphics', 'Brand & pixel graphics', <><div className="hello-graphics"><figure><img src="/icon.svg" width="40" height="40" alt="Pink flower with a yellow center"/><figcaption>nest. flower · SVG</figcaption></figure><figure><img src="/loading-text.svg" width="118" height="14" alt="loading..."/><figcaption>Loading lettering · Custom pixel SVG</figcaption></figure><figure><DemoDiamond/><figcaption>Glittering diamond · SVG & CSS</figcaption></figure></div><p className="hello-caption">The loading lettering is artwork, rather than an additional font.</p></>)}
        {section('characters', 'Roommate characters', <ul className="hello-characters">{CHARACTERS.map(character => <li key={character.id}><Character id={character.id}/><span>{character.name}</span></li>)}</ul>)}
      </section>
    </div>
  </main>;
}
