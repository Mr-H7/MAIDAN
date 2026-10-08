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

rollback;
