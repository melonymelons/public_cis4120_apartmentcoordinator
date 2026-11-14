import React from 'react';

import { CHARACTERS } from './characters.js';
export { CHARACTERS } from './characters.js';

export function Character({ id }) {
  const character = CHARACTERS.find(option => option.id === id);
  return character ? <span className="character-sprite" data-character={character.id} aria-hidden="true" style={{ backgroundPosition: `${character.x}% ${character.y}%` }}/> : null;
}

export default function Avatar({ person, small = false, className = '' }) {
  return <span className={`avatar ${small ? 'small' : ''} ${className} ${person.character ? 'has-character' : ''}`} style={{ background: person.color }}>
    {CHARACTERS.some(option => option.id === person.character) ? <Character id={person.character}/> : person.initial}
  </span>;
}

export function ResponsibilityCharacters({ ids, people }) {
  const owners = [...new Set(ids.filter(Boolean))].map(id => people.find(person => person.id === id)).filter(Boolean);
  if (!owners.length) return null;
  return <span className="responsibility-characters" aria-hidden="true">{owners.map(person => <span key={person.id} className="responsibility-character" data-owner={person.id}>
    {CHARACTERS.some(option => option.id === person.character) ? <Character id={person.character}/> : <Avatar person={person} small/>}
  </span>)}</span>;
}
