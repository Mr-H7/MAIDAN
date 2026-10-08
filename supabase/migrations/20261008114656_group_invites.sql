-- Invitation secrets stay in the private schema. Clients receive a code only through admin RPCs.
create table private.group_invites (
  group_id uuid primary key references public.groups(id) on delete cascade,
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{20}$'),
  code_hash bytea not null unique,
  enabled boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table private.retired_invite_hashes (
  code_hash bytea primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  retired_at timestamptz not null default now()
);
alter table private.group_invites enable row level security;
alter table private.retired_invite_hashes enable row level security;
revoke all on private.group_invites, private.retired_invite_hashes from public, anon, authenticated;

create function private.new_invite_code() returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea;
  i integer;
  out text := '';
begin
  raw := extensions.gen_random_bytes(20);
  for i in 0..19 loop
    out := out || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
  end loop;
  return out;
end $$;
revoke all on function private.new_invite_code() from public, anon, authenticated;

create function public.get_group_invite(p_group_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_row private.group_invites;
begin
  if not private.is_admin(p_group_id) then
    raise exception 'Admin permission required';
  end if;
  select * into v_row from private.group_invites where group_id = p_group_id;
  if v_row.group_id is null then
    return null;
  end if;
  return jsonb_build_object(
    'code', v_row.code,
    'enabled', v_row.enabled,
    'created_at', v_row.created_at
  );
end $$;

create function public.rotate_group_invite(p_group_id uuid) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_hash bytea;
  v_try integer;
  v_existing private.group_invites;
begin
  if not private.is_admin(p_group_id) then
    raise exception 'Admin permission required';
  end if;
  select * into v_existing from private.group_invites where group_id = p_group_id for update;
  for v_try in 1..8 loop
    v_code := private.new_invite_code();
    v_hash := extensions.digest(v_code, 'sha256');
    if not exists (select 1 from private.group_invites where code_hash = v_hash)
       and not exists (select 1 from private.retired_invite_hashes where code_hash = v_hash) then
      exit;
    end if;
    v_code := null;
  end loop;
  if v_code is null then
    raise exception 'Could not generate an invitation code';
  end if;
  if v_existing.group_id is not null then
    insert into private.retired_invite_hashes(code_hash, group_id)
    values (v_existing.code_hash, p_group_id)
    on conflict (code_hash) do nothing;
    update private.group_invites
      set code = v_code,
          code_hash = v_hash,
          enabled = true,
          created_by = auth.uid(),
          created_at = now(),
          updated_at = now()
      where group_id = p_group_id;
  else
    insert into private.group_invites(group_id, code, code_hash, enabled, created_by)
    values (p_group_id, v_code, v_hash, true, auth.uid());
  end if;
  insert into public.audit_logs(group_id, actor_id, action, entity_type, entity_id)
  values (p_group_id, auth.uid(), 'invite_rotated', 'group', p_group_id);
  return jsonb_build_object('code', v_code, 'enabled', true, 'created_at', now());
end $$;

create function public.set_group_invite_enabled(p_group_id uuid, p_enabled boolean) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_enabled is null then
    raise exception 'Invitation choice is required';
  end if;
  if not private.is_admin(p_group_id) then
    raise exception 'Admin permission required';
  end if;
  if not exists (select 1 from private.group_invites where group_id = p_group_id) then
    raise exception 'Generate an invitation first';
  end if;
  update private.group_invites
    set enabled = p_enabled, updated_at = now()
    where group_id = p_group_id;
  insert into public.audit_logs(group_id, actor_id, action, entity_type, entity_id, details)
  values (
    p_group_id,
    auth.uid(),
    case when p_enabled then 'invite_enabled' else 'invite_disabled' end,
    'group',
    p_group_id,
    '{}'::jsonb
  );
end $$;

create function public.join_group_with_invite(p_code text) returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_invite private.group_invites;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if v_code !~ '^[A-HJ-NP-Z2-9]{20}$' then
    raise exception 'Invalid or disabled invitation';
  end if;
  select * into v_invite
  from private.group_invites
  where code_hash = extensions.digest(v_code, 'sha256')
  for update;
  if v_invite.group_id is null or not v_invite.enabled or v_invite.code <> v_code then
    raise exception 'Invalid or disabled invitation';
  end if;
  insert into public.group_members(group_id, user_id, status)
  values (v_invite.group_id, v_user, 'active')
  on conflict (group_id, user_id) do update set status = 'active';
  insert into public.group_roles(group_id, user_id, role, granted_by)
  values (v_invite.group_id, v_user, 'player', v_invite.created_by)
  on conflict (group_id, user_id) do nothing;
  insert into public.audit_logs(group_id, actor_id, action, entity_type, entity_id)
  values (v_invite.group_id, v_user, 'member_joined_by_invite', 'profile', v_user);
  return v_invite.group_id;
end $$;

create function public.reopen_roster(p_session_id uuid) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_session public.football_sessions;
begin
  select * into v_session from public.football_sessions where id = p_session_id for update;
  if v_session.id is null or not private.is_admin(v_session.group_id) then
    raise exception 'Admin permission required';
  end if;
  if v_session.status <> 'locked' then
    raise exception 'Only a locked roster can be reopened';
  end if;
  if exists (select 1 from public.matches where session_id = p_session_id) then
    raise exception 'Fixtures already exist for this session';
  end if;
  if exists (select 1 from public.teams where session_id = p_session_id and status = 'published') then
    raise exception 'Published teams must be reopened first';
  end if;
  delete from public.team_players where session_id = p_session_id;
  delete from public.teams where session_id = p_session_id;
  update public.football_sessions
    set status = 'open', roster_locked_at = null
    where id = p_session_id;
  insert into public.audit_logs(group_id, actor_id, action, entity_type, entity_id)
  values (v_session.group_id, auth.uid(), 'roster_reopened', 'football_session', p_session_id);
end $$;

revoke all on function
  public.get_group_invite(uuid),
  public.rotate_group_invite(uuid),
  public.set_group_invite_enabled(uuid, boolean),
  public.join_group_with_invite(text),
  public.reopen_roster(uuid)
from public, anon;
grant execute on function
  public.get_group_invite(uuid),
  public.rotate_group_invite(uuid),
  public.set_group_invite_enabled(uuid, boolean),
  public.join_group_with_invite(text),
  public.reopen_roster(uuid)
to authenticated;
