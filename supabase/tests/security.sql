-- Run after migrations and seed with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
-- This script is intentionally transactional: all fixtures and attempted writes roll back.
begin;

insert into public.groups (id, name, created_by)
values ('10000000-0000-4000-8000-000000000002', 'Other private group', '00000000-0000-4000-8000-000000000021');
insert into public.group_members (group_id, user_id)
values ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000021');
insert into public.football_sessions (id, group_id, starts_at, ends_at, capacity, created_by)
values (
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  now() + interval '7 days',
  now() + interval '7 days 2 hours',
  20,
  '00000000-0000-4000-8000-000000000021'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

do $$
begin
  if exists (select 1 from public.groups where id = '10000000-0000-4000-8000-000000000002') then
    raise exception 'Group B leaked to Group A player';
  end if;
  if exists (select 1 from public.football_sessions where group_id = '10000000-0000-4000-8000-000000000002') then
    raise exception 'Group B session leaked to Group A player';
  end if;
  if exists (select 1 from public.group_members where group_id = '10000000-0000-4000-8000-000000000002') then
    raise exception 'Group B members leaked to Group A player';
  end if;
  begin
    perform public.lock_roster('30000000-0000-4000-8000-000000000002');
    raise exception 'Non-admin locked Group B roster';
  exception when others then
    if sqlerrm = 'Non-admin locked Group B roster' then raise; end if;
  end;
  begin
    insert into public.group_roles (group_id, user_id, role)
    values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'group_admin');
    raise exception 'Player self-assigned admin role';
  exception when others then
    if sqlerrm = 'Player self-assigned admin role' then raise; end if;
  end;
end $$;

reset role;
insert into auth.users(id, email, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000099',
  'invitee@example.invalid',
  '{"full_name":"Invitee"}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$
begin
  begin
    perform public.rotate_group_invite('10000000-0000-4000-8000-000000000001');
    raise exception 'Player rotated an invitation';
  exception when others then
    if sqlerrm = 'Player rotated an invitation' then raise; end if;
  end;
  begin
    perform public.get_group_invite('10000000-0000-4000-8000-000000000001');
    raise exception 'Player read an invitation code';
  exception when others then
    if sqlerrm = 'Player read an invitation code' then raise; end if;
  end;
  begin
    perform public.reopen_roster('30000000-0000-4000-8000-000000000001');
    raise exception 'Player reopened a roster';
  exception when others then
    if sqlerrm = 'Player reopened a roster' then raise; end if;
  end;
  begin
    perform 1 from private.group_invites;
    raise exception 'Invitation table was readable';
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm = 'Invitation table was readable' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
declare
  v_invite jsonb;
  v_code text;
  v_role text;
begin
  v_invite := public.rotate_group_invite('10000000-0000-4000-8000-000000000001');
  v_code := v_invite->>'code';
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);
  if public.join_group_with_invite(v_code) <> '10000000-0000-4000-8000-000000000001' then
    raise exception 'Invite did not join the issuing group';
  end if;
  select role::text into v_role
  from public.group_roles
  where group_id = '10000000-0000-4000-8000-000000000001'
    and user_id = '00000000-0000-4000-8000-000000000099';
  if v_role <> 'player' then
    raise exception 'Invite changed membership permission';
  end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  perform public.set_group_invite_enabled('10000000-0000-4000-8000-000000000001', false);
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);
  begin
    perform public.join_group_with_invite(v_code);
    raise exception 'Disabled invitation was accepted';
  exception when others then
    if sqlerrm = 'Disabled invitation was accepted' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  perform public.rotate_group_invite('10000000-0000-4000-8000-000000000001');
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);
  begin
    perform public.join_group_with_invite(v_code);
    raise exception 'Retired invitation was accepted';
  exception when others then
    if sqlerrm = 'Retired invitation was accepted' then raise; end if;
  end;
end $$;

rollback;
