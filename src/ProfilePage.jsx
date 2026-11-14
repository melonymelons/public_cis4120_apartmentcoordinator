import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icons';
import Avatar, { CHARACTERS, Character } from './Avatar';
import { availabilityLabel } from './availability';
import { AVATAR_COLORS, profileFields, householdList } from './household';
import { reduceMotion } from './motion';

export default function ProfilePage({ guest = false, state, onSaveProfile, onHousehold, onCreateHousehold, onInvite, onPerson, onSignOut }) {
  const [sections, setSections] = useState({ profile: true, apartment: true });
  const me = state.people.find(person => person.id === state.currentUser);
  const households = householdList(state).filter(household => household.people.some(person => person.id === me.id));
  return <div className="profile-grid">
    <ProfileSection id="your-profile" title="Your profile" icon="user" className="profile-self" open={sections.profile} onToggle={() => setSections(value => ({ ...value, profile: !value.profile }))}>
      <ProfileEditor key={`${me.id}-${state.householdId || 'original'}`} person={me} onSave={onSaveProfile}/>
    </ProfileSection>
    <ProfileSection id="your-apartment" title="Your apartment" icon="home" className="household-section" open={sections.apartment} onToggle={() => setSections(value => ({ ...value, apartment: !value.apartment }))}>
      {!households.length && <><p className="section-description">Set up your apartment or open an invitation from a roommate to get started.</p><button className="button primary" onClick={onCreateHousehold}><Icon name="plus" size={15}/>Set up apartment</button></>}
      {(state.householdId || !state.cloud) && <>
      <button className="household-name" aria-label={state.apartment} title="Rename apartment" onClick={onHousehold}><span className="household-home-icon" aria-hidden="true"><Icon name="home" size={20}/></span><span>{state.apartment}</span><span className="household-rename" aria-hidden="true"><Icon name="edit" size={13}/>Rename</span></button>
      <div className="household-members-heading"><h3>Roommates</h3><span className="count-pill">{state.people.length}</span><button className="button subtle small-button" aria-label="Invite members" onClick={onInvite}><Icon name="plus" size={14}/>Invite</button></div>
      <div className="household-members">{state.people.map(person => <article className="household-member" key={person.id} aria-label={`${person.name} household profile`}>
        <button className="household-member-detail" title={person.id === me.id ? 'Edit your profile' : `View ${person.name}’s availability`} onClick={() => {
          if (person.id !== me.id) { onPerson(person.id); return; }
          setSections(value => ({ ...value, profile: true }));
          requestAnimationFrame(() => document.getElementById('member-name')?.focus());
        }}><Avatar person={person}/><span><strong>{person.name}{person.id === me.id && <small>you</small>}</strong><span>{availabilityLabel(person)}</span></span><Icon name={person.id === me.id ? 'edit' : 'chevron'} size={15}/></button>
      </article>)}</div>
      </>}
    </ProfileSection>
    {onSignOut && <footer className="profile-account-actions"><button type="button" className="button subtle profile-sign-out" onClick={onSignOut}><Icon name="away" size={16}/> {guest ? 'Exit guest mode' : 'Sign out'}</button></footer>}
  </div>;
}

export function ProfileSection({ id, title, icon, className, open, onToggle, children, count, ariaLabel }) {
  const panel = useRef(null), motion = useRef(null), wasOpen = useRef(open);
  useLayoutEffect(() => {
    const el = panel.current, changed = wasOpen.current !== open;
    wasOpen.current = open;
    const hidden = el.hidden;
    const fromHeight = hidden ? 0 : el.getBoundingClientRect().height;
    const fromOpacity = hidden ? 0 : getComputedStyle(el).opacity;
    const fromTransform = hidden ? 'translateY(-6px)' : getComputedStyle(el).transform;
    motion.current?.cancel(); motion.current = null;
    if (!changed || reduceMotion() || !el.animate) { el.hidden = !open; return; }
    el.hidden = false;
    const toHeight = open ? el.scrollHeight : 0;
    const animation = el.animate([
      { height: `${fromHeight}px`, opacity: fromOpacity, transform: fromTransform, overflow: 'hidden' },
      { height: `${toHeight}px`, opacity: open ? 1 : 0, transform: open ? 'translateY(0)' : 'translateY(-6px)', overflow: 'hidden' },
    ], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
    motion.current = animation;
    animation.finished.then(() => {
      if (motion.current !== animation) return;
      animation.cancel(); motion.current = null; el.hidden = !open;
    }).catch(() => {});
  }, [open]);
  useEffect(() => () => motion.current?.cancel(), []);
  return <section className={`list-page profile-section ${className}`} aria-label={ariaLabel}>
    <h2 className="profile-section-heading"><button type="button" id={`${id}-toggle`} className="profile-section-toggle" aria-expanded={open} aria-controls={`${id}-content`} onClick={onToggle}>
      <Icon name={icon} size={18}/><span>{title}</span>{count !== undefined && <small className="section-panel-count">{count}</small>}<Icon name="down" size={16}/>
    </button></h2>
    <div ref={panel} id={`${id}-content`} className="profile-section-panel" role="region" aria-labelledby={`${id}-toggle`} aria-hidden={!open} inert={!open}><div className="profile-section-body">{children}</div></div>
  </section>;
}

export function ProfileEditor({ person, onSave }) {
  const [name, setName] = useState(person.name);
  const [color, setColor] = useState(person.color);
  const [character, setCharacter] = useState(person.character || null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const previous = useRef(person);
  useEffect(() => {
    const old = previous.current;
    if (name === old.name && color === old.color && character === (old.character || null)) {
      setName(person.name); setColor(person.color); setCharacter(person.character || null);
    }
    previous.current = person;
  }, [person.name, person.color, person.character]);
  const dirty = name.trim() !== person.name || color !== person.color || character !== (person.character || null);
  const preview = { ...profileFields(name, color), character };
  function changed(update) { setSaveError(''); update(); }
  return <form className="inline-profile-form" aria-label="Your profile" onSubmit={async event => {
    event.preventDefault();
    if (name.trim() && !saving) {
      setSaving(true); setSaveError('');
      try {
        const success = await onSave({ ...profileFields(name, color), character });
        if (success !== false) { setName(name.trim()); }
        else setSaveError('Couldn’t save your profile. Try again.');
      } catch { setSaveError('Couldn’t save your profile. Try again.'); }
      finally { setSaving(false); }
    }
  }}>
    <div className="profile-summary"><Avatar person={preview} className="profile-avatar"/><div><label className="field-label" htmlFor="member-name">Name</label><input id="member-name" value={name} onChange={event => changed(() => setName(event.target.value))} maxLength={40} required autoComplete="name" disabled={saving}/></div></div>
    <fieldset className="character-picker" disabled={saving}><legend>Character</legend><p className="profile-field-help">Shown beside your assigned tasks.</p><div>
      {CHARACTERS.map(option => <button type="button" key={option.id} aria-label={option.name} aria-pressed={character === option.id} className={character === option.id ? 'selected' : ''} onClick={() => changed(() => setCharacter(option.id))}><Character id={option.id}/><span className="profile-character-name">{option.name}</span>{character === option.id && <span className="character-selected"><Icon name="check" size={10}/></span>}</button>)}
    </div><button type="button" aria-label="Use initial instead of character" aria-pressed={!character} className={`profile-initial-option ${!character ? 'selected' : ''}`} onClick={() => changed(() => setCharacter(null))}><Avatar person={profileFields(name, color)} small/><span>Use my initial</span>{!character && <Icon name="check" size={13}/>}</button></fieldset>
    <fieldset className="avatar-colors" disabled={saving}><legend>Avatar background</legend><div>{AVATAR_COLORS.map(option => <button type="button" key={option.value} style={{ background: option.value }} className={color === option.value || color === option.legacy ? 'selected' : ''} aria-label={option.name} title={option.name} aria-pressed={color === option.value || color === option.legacy} onClick={() => changed(() => setColor(option.value))}></button>)}</div></fieldset>
    {saveError && <p className="profile-save-error" role="alert">{saveError}</p>}
    <div className="profile-save-row">{dirty && <button type="button" className="button subtle profile-reset" disabled={saving} onClick={() => { setName(person.name); setColor(person.color); setCharacter(person.character || null); setSaveError(''); }}>Reset</button>}<button className="button primary" disabled={!dirty || !name.trim() || saving}>{saving ? 'Saving…' : 'Save profile'}<Icon name="check" size={15}/></button></div>
  </form>;
}

export function HouseholdDialog({ name: initialName = '', creating = false, onSave, onClose }) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = creating || name.trim() !== initialName.trim();
  return <Modal title={creating ? 'Set up apartment' : 'Rename apartment'} className="household-modal" onClose={onClose}>
    <form onSubmit={async event => {
      event.preventDefault();
      if (!name.trim() || !changed || busy) return;
      setBusy(true); setError('');
      try { await onSave(name.trim()); }
      catch { setError('Couldn’t save the apartment name. Please try again.'); }
      finally { setBusy(false); }
    }}>
      <label className="field-label" htmlFor="household-name">{creating ? 'Apartment name' : 'Household name'}</label>
      <input id="household-name" data-initial-focus required maxLength={45} value={name} disabled={busy} onFocus={event => event.target.select()} onChange={event => { setName(event.target.value); setError(''); }} autoComplete="off"/>
      {error && <p className="household-save-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancel</button><button className="button primary" disabled={!name.trim() || !changed || busy}>{busy ? 'Saving…' : creating ? 'Create apartment' : 'Save household'}</button></div>
    </form>
  </Modal>;
}
