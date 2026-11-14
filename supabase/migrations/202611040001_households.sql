-- Apply once to a fresh Supabase project. Identity always comes from auth.uid().
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  initial text generated always as (upper(left(name, 1))) stored,
  color text not null default '#eddcc8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  character text check (character in ('sage','peach','sky','lilac','sunny','rose'))
);
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 45),
  created_by uuid not null references auth.users(id),
  data jsonb not null default '{"rooms":[],"objects":[],"tasks":[],"inventory":[],"canvas":{"cols":12,"rows":14}}',
  revision bigint not null default 0
);
create table public.household_members (
  household_id uuid references public.households(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text check (status in ('Home & free','Leaving soon','Studying','Away')),
  expires bigint,
  routine jsonb not null default '[]' check (jsonb_typeof(routine) = 'array'),
  primary key (household_id, user_id)
); 
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token_hash bytea unique not null,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked boolean not null default false,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null
);
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

-- Definer avoids recursive membership policies. Never accepts an actor argument.
create function public.is_household_member(p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.household_members where household_id = p_household and user_id = auth.uid());
$$;
revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or exists (select 1 from public.household_members member where member.user_id = profiles.id and public.is_household_member(member.household_id))
);
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy households_read on public.households for select to authenticated using (public.is_household_member(id));
create policy members_read on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy members_update_self on public.household_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.profiles, public.households, public.household_members, public.household_invites from anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update(name, color, character) on public.profiles to authenticated;
grant select on public.households, public.household_members to authenticated;
grant update(status, expires, routine) on public.household_members to authenticated;

create function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id = auth.uid()) then raise exception 'Sign in and create your own profile first'; end if;
  insert into public.households(name, created_by) values (btrim(p_name), auth.uid()) returning id into result;
  insert into public.household_members(household_id, user_id) values(result, auth.uid());
  return result;
end;
$$;

create function public.create_household_invite(p_household uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare token text; invitation public.household_invites;
begin
  if auth.uid() is null or not public.is_household_member(p_household) then raise exception 'Not a household member'; end if;
  token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.household_invites(household_id, token_hash, created_by)
    values(p_household, sha256(convert_to(token, 'UTF8')), auth.uid()) returning * into invitation;
  return jsonb_build_object('id', invitation.id, 'token', token, 'expiresAt', invitation.expires_at);
end;
$$;

create function public.preview_household_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare invitation public.household_invites; household_name text;
begin
  if auth.uid() is null then raise exception 'Sign in to view the invitation'; end if;
  select * into invitation from public.household_invites where token_hash = sha256(convert_to(p_token, 'UTF8'));
  if not found or invitation.revoked or invitation.expires_at <= now() or (invitation.used_at is not null and not public.is_household_member(invitation.household_id)) then raise exception 'This invitation has expired or is no longer available'; end if;
  select name into household_name from public.households where id = invitation.household_id;
  return jsonb_build_object('name', household_name, 'expiresAt', invitation.expires_at);
end;
$$;

create function public.accept_household_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare invitation public.household_invites;
begin
  if auth.uid() is null then raise exception 'Sign in to join a household'; end if;
  -- Row lock makes one-use redemption atomic, including simultaneous requests.
  select * into invitation from public.household_invites where token_hash = sha256(convert_to(p_token, 'UTF8')) for update;
  if not found or invitation.revoked or invitation.expires_at <= now() then raise exception 'This invitation has expired or is no longer available'; end if;
  if public.is_household_member(invitation.household_id) then return invitation.household_id; end if;
  if invitation.used_at is not null then raise exception 'This invitation has already been used'; end if;
  insert into public.household_members(household_id, user_id) values(invitation.household_id, auth.uid());
  update public.household_invites set used_at = now(), used_by = auth.uid() where id = invitation.id;
  return invitation.household_id;
end;
$$;

create function public.revoke_household_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.household_invites invitation set revoked = true where invitation.id = p_invite and
    (invitation.created_by = auth.uid() or exists(select 1 from public.households where id = invitation.household_id and created_by = auth.uid()));
  if not found then raise exception 'Invitation unavailable'; end if;
end;
$$;

create function public.save_household(p_household uuid, p_revision bigint, p_name text, p_data jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare saved public.households; task jsonb; previous jsonb; item jsonb; prior_item jsonb; actor text := auth.uid()::text;
begin
  if auth.uid() is null or not public.is_household_member(p_household) then raise exception 'Not a household member'; end if;
  select * into saved from public.households where id = p_household for update;
  if saved.revision is distinct from p_revision then raise exception 'HOUSEHOLD_CONFLICT: Household changed on another device. Reload before saving.'; end if;
  if jsonb_typeof(p_data->'rooms') is distinct from 'array' or jsonb_typeof(p_data->'objects') is distinct from 'array' or jsonb_typeof(p_data->'tasks') is distinct from 'array' or jsonb_typeof(p_data->'inventory') is distinct from 'array' then raise exception 'Invalid household data'; end if;
  for task in select value from jsonb_array_elements(p_data->'tasks') loop
    select value into previous from jsonb_array_elements(saved.data->'tasks') where value->>'id' = task->>'id';
    if task->>'status' is null or task->>'status' not in ('open','pending','assigned','done') or task->>'id' is null then raise exception 'Invalid task'; end if;
    if previous is null then
      if task->>'from' is distinct from actor or not coalesce((
        (task->>'status' = 'open' and task->>'to' is null) or
        (task->>'status' in ('assigned','done') and task->>'to' = actor) or
        (task->>'status' = 'pending' and task->>'to' is distinct from actor and exists(select 1 from public.household_members where household_id = p_household and user_id::text = task->>'to'))
      ), false) then raise exception 'New tasks must be created by you and cannot assign work to others without acceptance'; end if;
    elsif (task->>'status', task->>'to', task->>'from') is distinct from (previous->>'status', previous->>'to', previous->>'from') then
      if not coalesce((
        (previous->>'status' = 'open' and task->>'status' = 'pending' and task->>'from' = actor and task->>'to' is distinct from actor and exists(select 1 from public.household_members where household_id = p_household and user_id::text = task->>'to')) or
        (previous->>'status' = 'open' and task->>'status' in ('assigned','done') and task->>'to' = actor and task->>'from' is not distinct from previous->>'from') or
        (previous->>'status' = 'pending' and task->>'status' in ('assigned','done') and previous->>'to' = actor and task->>'to' = actor and task->>'from' is not distinct from previous->>'from') or
        (previous->>'status' = 'pending' and task->>'status' = 'open' and (previous->>'to' = actor or previous->>'from' = actor) and task->>'to' is null and task->>'from' is not distinct from previous->>'from') or
        (previous->>'status' = 'assigned' and task->>'status' = 'done' and previous->>'to' = actor and task->>'to' = actor and task->>'from' is not distinct from previous->>'from') or
        (previous->>'status' = 'assigned' and task->>'status' = 'open' and previous->>'to' = actor and task->>'to' is null and task->>'from' is not distinct from previous->>'from') or
        (previous->>'status' = 'assigned' and task->>'status' = 'pending' and previous->>'to' = actor and task->>'to' = actor and task->>'from' is not distinct from previous->>'from') or
        (previous->>'status' = 'done' and task->>'status' = 'assigned' and previous->>'to' = actor and task->>'to' = actor and task->>'from' is not distinct from previous->>'from')
      ), false) then raise exception 'You cannot change another member''s assignment'; end if;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_data->'inventory') loop
    if item->>'status' is null or item->>'status' not in ('in','low','out','unknown') then raise exception 'Invalid stock level'; end if;
    select value into prior_item from jsonb_array_elements(saved.data->'inventory') where value->>'id' = item->>'id';
    if item->>'buyerId' is distinct from prior_item->>'buyerId' then
      if item->>'buyerId' is not null and (item->>'buyerId' <> actor or prior_item->>'buyerId' is not null) then raise exception 'You can only claim an unclaimed purchase for yourself'; end if;
      if item->>'buyerId' is null and prior_item->>'buyerId' is not null and prior_item->>'buyerId' <> actor and item->>'status' in ('low','out') then raise exception 'Only the buyer can release this purchase'; end if;
    end if;
  end loop;
  update public.households set name = btrim(p_name), revision = revision + 1,
    data = jsonb_build_object('rooms', p_data->'rooms', 'objects', p_data->'objects', 'tasks', p_data->'tasks', 'inventory', p_data->'inventory', 'canvas', p_data->'canvas')
    where id = p_household returning revision into p_revision;
  return p_revision;
end;
$$;

revoke all on function public.create_household(text), public.create_household_invite(uuid), public.preview_household_invite(text), public.accept_household_invite(text), public.revoke_household_invite(uuid), public.save_household(uuid,bigint,text,jsonb) from public;
grant execute on function public.create_household(text), public.create_household_invite(uuid), public.preview_household_invite(text), public.accept_household_invite(text), public.revoke_household_invite(uuid), public.save_household(uuid,bigint,text,jsonb) to authenticated;
