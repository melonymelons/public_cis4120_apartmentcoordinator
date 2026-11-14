import React, { useState } from 'react';
import Modal from './Modal';
import Icon from './Icons';
import { revokeInvite } from './cloud/households';

export default function InviteDialog({ householdName, onCreate, onClose, guest = false }) {
  const [invitation, setInvitation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  return <Modal title="Invite members" subtitle={householdName} className="invite-modal" onClose={onClose}>
    {!onCreate && !guest ? <p className="invite-description">Household invitations are not connected yet.</p> : <>
      <div className="invite-intro"><span className="invite-intro-icon"><Icon name="people" size={22}/></span><p>Create a private link for a roommate to join with their own account.</p></div>
      {invitation ? <div className="invite-link-content">
        <label className="field-label" htmlFor="household-invite-link">Join link</label><input id="household-invite-link" readOnly value={invitation.url} onFocus={event => event.target.select()}/>
        <p className="invite-link-note">Single use · Expires {new Date(invitation.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        <div className="invite-link-actions"><button className="button primary" disabled={busy} onClick={async () => {
          try { await navigator.clipboard.writeText(invitation.url); setCopied(true); setError(''); }
          catch { document.getElementById('household-invite-link')?.select(); setError('Select and copy the link above.'); }
        }}><Icon name={copied ? 'check' : 'requests'} size={15}/>{copied ? 'Copied' : 'Copy link'}</button>
        <a className="button subtle" aria-disabled={busy || undefined} href={busy ? undefined : `mailto:?subject=${encodeURIComponent(`Join ${householdName} on nest.`)}&body=${encodeURIComponent(`Join our household on nest.:\n${invitation.url}`)}`}>Email link<Icon name="arrow" size={15}/></a></div>
        <button className="button subtle invite-revoke" disabled={busy} onClick={async () => {
          setBusy(true); setError('');
          try { await revokeInvite(invitation.id); setInvitation(null); setCopied(false); }
          catch { setError('Couldn’t revoke this link. Please try again.'); }
          finally { setBusy(false); }
        }}><Icon name="trash" size={14}/>{busy ? 'Revoking…' : 'Revoke link'}</button>
      </div> : <button className="button primary invite-create" disabled={busy} onClick={async () => {
        if (guest) { setError('Invites aren’t available for guest accounts. Sign in to invite roommates.'); return; }
        setBusy(true); setError('');
        try { setInvitation(await onCreate()); }
        catch { setError('Couldn’t create an invitation. Please try again.'); }
        finally { setBusy(false); }
      }}>{busy ? 'Creating…' : 'Create invite link'}<Icon name="plus" size={15}/></button>}
      {copied && <span className="sr-only" role="status">Invite link copied</span>}
    </>}
    {error && <p className="invite-error" role="alert">{error}</p>}
  </Modal>;
}
