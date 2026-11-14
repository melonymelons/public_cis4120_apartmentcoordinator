import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './client';
import { acceptInvite, createCloudHousehold, createInvite, ensureProfile, fetchHouseholds, householdData, persistHouseholds, previewInvite, saveProfile } from './households';
import { householdList } from '../household';
import Icon from '../Icons';
import LoadingScreen, { LoadingGate } from '../LoadingScreen';

const inviteToken = () => new URL(location.href).searchParams.get('invite');
const signature = state => JSON.stringify(householdList(state).map(household => ({
  id: household.id, name: household.apartment, data: householdData(household),
  self: household.people.filter(person => person.id === state.currentUser).map(person => ({ status: person.status, expires: person.expires, routine: person.routine })),
})));

function signInRedirect() {
  const redirect = new URL(location.origin + location.pathname);
  if (inviteToken()) redirect.searchParams.set('invite', inviteToken());
  return redirect.href;
}

function MotionWelcome({ onContinue }) {
  return <main className="account-screen motion-welcome" aria-labelledby="motion-welcome-title">
    <img src="/icon.svg" alt="" width="34" height="34"/>
    <h1 id="motion-welcome-title">See nest. in motion</h1>
    <p>To enjoy the rotating flower and apartment animations, we recommend turning Reduce Motion off if you’re comfortable with motion.</p>
    <section className="motion-iphone-steps" aria-label="iPhone instructions"><h2>On your iPhone</h2><ol><li>Open <strong>Settings</strong>.</li><li>Tap <strong>Accessibility → Motion</strong>.</li><li>Turn <strong>Reduce Motion</strong> off, then return here.</li></ol></section>
    <p className="motion-optional">Prefer less motion? You can keep it on and use all of nest.</p>
    <button type="button" className="button primary" onClick={onContinue}>Continue to sign in<Icon name="arrow" size={16}/></button>
  </main>;
}

function AuthScreen({ error: initialError, onRetry, onGuest }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [motionIntro, setMotionIntro] = useState(true);
  if (motionIntro) return <MotionWelcome onContinue={() => setMotionIntro(false)}/>;
  return <main className="account-screen welcome-screen"><div className="welcome-intro"><img className="welcome-flower" src="/icon.svg" alt="" width="34" height="34"/><h1>Welcome to nest.</h1></div>{inviteToken() && <p>Sign in to join your household.</p>}
    {initialError && <p role="alert">{initialError}</p>}
    <div className="welcome-form-area"><form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(''); setSent(false);
      try {
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: signInRedirect() } });
        if (error) throw error;
        setSent(true);
      } catch (failure) {
        if (failure.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(failure.code)) setError('Supabase’s email service has reached its sending limit. Try again later, or continue as guest.');
        else if (failure.code === 'email_address_not_authorized') setError('Supabase’s test email service can only send to approved team addresses. Please continue as guest.');
        else setError('The sign-in email couldn’t be sent through Supabase. Try again later, or continue as guest.');
      }
      finally { setBusy(false); }
    }}><label className="field-label" htmlFor="account-email">Email</label><input id="account-email" type="email" required autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setSent(false); }}/><button className="button primary full-width" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}<Icon name="arrow" size={16}/></button></form>
    <div className="welcome-after-email"><div className="welcome-feedback">{sent && <p role="status">Check your email for a sign-in link. You can close this tab after opening it.</p>}{error && <p role="alert">{error}</p>}{onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}</div>
    {onGuest && <div className="welcome-guest"><button type="button" className="button subtle full-width" disabled={busy} onClick={onGuest}>Continue as guest<Icon name="arrow" size={16}/></button><p>Try a demo apartment. Changes stay on this browser.</p></div>}</div></div>
  </main>;
}

function JoinHousehold({ user, existingApartment, token, onJoin, onCancel }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    previewInvite(token).then(value => { if (live) setPreview(value); }).catch(() => { if (live) setError('This invitation has expired or is no longer available. Ask your roommate for a new link.'); });
    return () => { live = false; };
  }, [token]);
  return <main className="account-screen"><img src="/icon.svg" alt="" width="34" height="34"/><h1>{preview ? `Join ${preview.name}` : 'Your household invitation'}</h1>
    {existingApartment ? <p>You already belong to {existingApartment}. You can only have one apartment at a time.</p> : error ? <p role="alert">{error}</p> : <p>{preview ? 'Share the apartment, coordinate tasks, and make yourself at home.' : 'Checking invitation…'}</p>}
    {preview && !error && !existingApartment && <button className="button primary full-width" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await ensureProfile(user); const id = await acceptInvite(token); await onJoin(id); }
      catch (failure) { setError(failure.message?.includes('already belong') ? 'You already belong to an apartment. Refresh to open your current apartment.' : 'This invitation could not be accepted. It may have expired or already been used.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Joining…' : 'Join household'}<Icon name="arrow" size={16}/></button>}
    <button className="text-button" onClick={onCancel}>{existingApartment ? 'Open your apartment' : 'Continue without joining'}</button>
  </main>;
}

function ConnectedApp({ App }) {
  const [user, setUser] = useState(undefined);
  const [guest, setGuest] = useState(() => { try { return sessionStorage.getItem('nest-guest-mode') === 'true'; } catch { return false; } });
  const changeGuest = value => { try { if (value) sessionStorage.setItem('nest-guest-mode', 'true'); else sessionStorage.removeItem('nest-guest-mode'); } catch { /* Guest access still works when storage is unavailable. */ } setGuest(value); };
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [token, setToken] = useState(inviteToken);
  const baseline = useRef(null), latest = useRef(null), timer = useRef(null), pending = useRef(null), version = useRef(0);
  const owner = useRef(null);
  const loadVersion = useRef(0);
  const loadingStarted = useRef(null);
  const selectedKey = id => `nest-household-${id}`;
  function clearInvite() {
    loadingStarted.current = performance.now();
    const url = new URL(location.href); url.searchParams.delete('invite'); history.replaceState(null, '', url); setToken(null);
  }
  const load = useCallback(async preferred => {
    const id = owner.current;
    if (!id || !user) return;
    const request = ++loadVersion.current;
    version.current += 1;
    const value = await fetchHouseholds(user, preferred || latest.current?.householdId || localStorage.getItem(selectedKey(id)));
    if (owner.current !== id || request !== loadVersion.current) return;
    baseline.current = value; latest.current = value; setModel(value); setError('');
    return value;
  }, [user]);
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => { if (live) { setUser(data.session?.user || null); if (error) setError('We couldn’t restore your session. Please sign in again.'); } });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    owner.current = user?.id || null; baseline.current = null; latest.current = null; setModel(null); setSyncError('');
    loadingStarted.current = user ? performance.now() : null;
    clearTimeout(timer.current);
    if (user) { changeGuest(false); load().catch(() => setError('We couldn’t load your household. Please try again.')); }
  }, [user?.id]);

  const flush = useCallback(async () => {
    if (pending.current) { await pending.current; return flush(); }
    if (!latest.current || !baseline.current || signature(latest.current) === signature(baseline.current)) return;
    const id = owner.current, snapshot = latest.current, generation = version.current;
    const operation = (async () => {
      const saved = await persistHouseholds(snapshot, baseline.current, value => { if (owner.current === id) baseline.current = value; });
      if (owner.current !== id) return;
      baseline.current = saved;
      if (generation === version.current) {
        const fresh = await fetchHouseholds(user, snapshot.householdId);
        if (owner.current === id && generation === version.current) {
          baseline.current = fresh;
          latest.current = fresh; setModel(fresh);
        }
      }
      setSyncError('');
    })();
    pending.current = operation;
    try { await operation; }
    catch (failure) {
      if (owner.current === id) setSyncError(failure.message.includes('HOUSEHOLD_CONFLICT') ? 'This household changed on another device. Reload to see the latest version before saving.' : 'Your changes haven’t synced yet. Check your connection and try again.');
      throw failure;
    } finally { if (pending.current === operation) pending.current = null; }
    if (latest.current && baseline.current && signature(latest.current) !== signature(baseline.current)) return flush();
  }, [user]);

  const receive = useCallback(value => {
    latest.current = value; version.current += 1;
    if (value.householdId) localStorage.setItem(selectedKey(value.currentUser), value.householdId);
    clearTimeout(timer.current);
    if (baseline.current && signature(value) !== signature(baseline.current)) timer.current = setTimeout(() => { flush().catch(() => {}); }, 450);
  }, [flush]);

  useEffect(() => {
    if (!user) return;
    async function refresh() {
      if (!latest.current || !baseline.current || pending.current || signature(latest.current) !== signature(baseline.current)) return;
      const id = owner.current, generation = version.current;
      try {
        const fresh = await fetchHouseholds(user, latest.current.householdId);
        if (owner.current === id && generation === version.current && !pending.current) { baseline.current = fresh; latest.current = fresh; setModel(fresh); }
      } catch { /* Keep the loaded household while temporarily offline. */ }
    }
    const interval = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh); clearTimeout(timer.current); };
  }, [user?.id]);

  if (user === undefined) return <main className="account-screen" aria-busy="true" aria-label="Restoring session"/>;
  if (!user && guest) return <LoadingGate><App key="guest" guest storageKey="nest-guest-v1" onSignOut={async () => changeGuest(false)}/></LoadingGate>;
  if (!user) return <AuthScreen error={error} onGuest={() => changeGuest(true)}/>;
  if (!model) return error ? <main className="account-screen"><p role="alert">{error}</p><button className="button primary" onClick={() => load().catch(() => setError('We couldn’t load your household. Please try again.'))}>Try again</button><button className="text-button" onClick={() => supabase.auth.signOut()}>Sign out</button></main> : token ? <main className="account-screen" aria-busy="true" aria-label="Opening invitation"/> : <LoadingScreen startedAt={loadingStarted.current}/>;
  if (token) return <JoinHousehold user={user} existingApartment={model.householdId ? model.apartment : null} token={token} onCancel={clearInvite} onJoin={async id => { await load(id); clearInvite(); }}/>;
  return <LoadingGate startedAt={loadingStarted.current} bypass={!model.householdId}><><App key={user.id} initialData={model} account={user} onStateChange={receive}
    onSaveCloudProfile={async fields => { await flush(); await saveProfile(user.id, fields); }}
    onCreateCloudHousehold={async name => { await flush(); const id = await createCloudHousehold(name); await load(id); }}
    onCreateInvite={async () => { await flush(); return createInvite(latest.current.householdId); }}
    onSignOut={async () => { await flush(); await supabase.auth.signOut(); }}/>
    {syncError && <div className="cloud-sync-error" role="alert"><span>{syncError}</span><button className="button subtle small-button" onClick={() => syncError.includes('Reload') ? location.reload() : flush().catch(() => {})}>{syncError.includes('Reload') ? 'Reload' : 'Retry'}</button></div>}
  </></LoadingGate>;
}

export default function CloudShell({ App }) {
  return supabase ? <ConnectedApp App={App}/> : <LoadingGate><App/></LoadingGate>;
}
