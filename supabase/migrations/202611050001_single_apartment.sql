-- One apartment per account. No existing membership/data is deleted.
-- If legacy accounts have multiple memberships, resolve those explicitly before
-- running this migration; the unique index will refuse to discard any data.
create unique index if not exists household_members_one_apartment_per_user
  on public.household_members(user_id);

create or replace function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id = auth.uid()) then raise exception 'Sign in and create your own profile first'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if exists(select 1 from public.household_members where user_id = auth.uid()) then raise exception 'You already belong to an apartment'; end if;
  insert into public.households(name, created_by) values(btrim(p_name), auth.uid()) returning id into result;
  insert into public.household_members(household_id, user_id) values(result, auth.uid());
  return result;
end;
$$;

create or replace function public.accept_household_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare invitation public.household_invites;
begin
  if auth.uid() is null then raise exception 'Sign in to join an apartment'; end if;
  -- Serialize creation/redemption for the same account. The unique index also
  -- enforces the rule for every other membership insert path.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into invitation from public.household_invites where token_hash = sha256(convert_to(p_token, 'UTF8')) for update;
  if not found or invitation.revoked or invitation.expires_at <= now() then raise exception 'This invitation has expired or is no longer available'; end if;
  if public.is_household_member(invitation.household_id) then return invitation.household_id; end if;
  if exists(select 1 from public.household_members where user_id = auth.uid()) then raise exception 'You already belong to an apartment'; end if;
  if invitation.used_at is not null then raise exception 'This invitation has already been used'; end if;
  insert into public.household_members(household_id, user_id) values(invitation.household_id, auth.uid());
  update public.household_invites set used_at = now(), used_by = auth.uid() where id = invitation.id;
  return invitation.household_id;
end;
$$;

revoke all on function public.create_household(text), public.accept_household_invite(text) from public, anon;
grant execute on function public.create_household(text), public.accept_household_invite(text) to authenticated;
