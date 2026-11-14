import { supabase } from './client';
import { householdList } from '../household';

async function checked(request) {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data;
}

export async function ensureProfile(user) {
  const existing = await checked(supabase.from('profiles').select('*').eq('id', user.id).maybeSingle());
  if (existing) return existing;
  const name = String(user.user_metadata?.name || user.email?.split('@')[0] || 'Roommate').slice(0, 40);
  // Two tabs can initialize the same account simultaneously. Ignore a duplicate
  // insert, then read the existing profile rather than overwriting its choices.
  const created = await checked(supabase.from('profiles').upsert({ id: user.id, name, color: '#eddcc8' }, { onConflict: 'id', ignoreDuplicates: true }).select().maybeSingle());
  return created || checked(supabase.from('profiles').select('*').eq('id', user.id).single());
}

export function householdData(household) {
  return {
    rooms: household.rooms || [], objects: household.objects || [], tasks: household.tasks || [],
    inventory: household.inventory || [], canvas: household.canvas || { cols: 12, rows: 14 },
  };
}

export async function fetchHouseholds(user, preferredId) {
  const self = await ensureProfile(user);
  const [rows, members, profiles] = await Promise.all([
    checked(supabase.from('households').select('id,name,data,revision').order('name')),
    checked(supabase.from('household_members').select('*')),
    checked(supabase.from('profiles').select('*')),
  ]);
  const households = rows.map(row => ({
    id: row.id, apartment: row.name, ...row.data, formerPeople: [], revision: row.revision,
    people: members.filter(member => member.household_id === row.id).map(member => {
      const profile = profiles.find(profile => profile.id === member.user_id);
      return { ...profile, status: member.status, expires: member.expires == null ? null : Number(member.expires), routine: member.routine };
    }),
  }));
  const selected = households.find(household => household.id === preferredId) || households[0];
  return {
    version: 1, cloud: true, currentUser: user.id, households,
    householdId: selected?.id || null, apartment: '', rooms: [], objects: [], tasks: [], inventory: [],
    people: [{ ...self, status: null, expires: null, routine: [] }], ...selected,
  };
}

export async function saveProfile(id, fields) {
  await checked(supabase.from('profiles').update({ name: fields.name.trim(), color: fields.color, character: fields.character }).eq('id', id));
}

export async function createCloudHousehold(name) {
  return checked(supabase.rpc('create_household', { p_name: name }));
}

export async function createInvite(householdId) {
  const invitation = await checked(supabase.rpc('create_household_invite', { p_household: householdId }));
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('invite', invitation.token);
  return { ...invitation, url: url.href };
}
export const previewInvite = token => checked(supabase.rpc('preview_household_invite', { p_token: token }));
export const acceptInvite = token => checked(supabase.rpc('accept_household_invite', { p_token: token }));
export const revokeInvite = id => checked(supabase.rpc('revoke_household_invite', { p_invite: id }));

export async function persistHouseholds(next, baseline, onProgress = () => {}) {
  const saved = structuredClone(householdList(baseline));
  const result = () => ({ ...baseline, households: saved, ...saved.find(household => household.id === baseline.householdId) });
  for (const household of householdList(next)) {
    const old = saved.find(item => item.id === household.id);
    if (!old) continue; // Membership/creation is handled by authenticated RPCs only.
    if (household.apartment !== old.apartment || JSON.stringify(householdData(household)) !== JSON.stringify(householdData(old))) {
      const revision = await checked(supabase.rpc('save_household', {
        p_household: household.id, p_revision: old.revision, p_name: household.apartment, p_data: householdData(household),
      }));
      // Keep the latest revision even if a subsequent household save fails.
      old.revision = revision;
      old.apartment = household.apartment;
      Object.assign(old, householdData(household));
      onProgress(result());
    }
    const me = household.people.find(person => person.id === next.currentUser);
    const before = old.people.find(person => person.id === next.currentUser);
    const availability = person => ({ status: person.status, expires: person.expires, routine: person.routine || [] });
    if (me && before && JSON.stringify(availability(me)) !== JSON.stringify(availability(before))) {
      await checked(supabase.from('household_members').update(availability(me)).eq('household_id', household.id).eq('user_id', next.currentUser));
      Object.assign(before, availability(me));
      onProgress(result());
    }
  }
  return result();
}
