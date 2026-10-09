-- DRAFT FOR REVIEW. Do not apply to the production project without impact approval.
-- Additive reserve identities/teams and typed fixtures; existing rows default to main.
alter table public.teams add column kind text not null default 'main'
  check (kind in ('main', 'reserve'));
alter table public.matches add column match_type text not null default 'main_main'
  check (match_type in ('main_main', 'reserve_reserve', 'reserve_main'));
alter table public.matches add column priority_acknowledged_by uuid references public.profiles(id);
alter table public.matches add column created_by uuid references public.profiles(id);
alter table public.matches add constraint match_type_duration check (
  (match_type = 'main_main' and duration_seconds = 600) or
  (match_type in ('reserve_reserve', 'reserve_main') and duration_seconds = 480)
) not valid;

create table public.reserve_players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  session_id uuid not null,
  full_name text not null check (length(trim(full_name)) between 2 and 100),
  preferred_position text check (preferred_position in ('Goalkeeper','Defender','Midfielder','Forward')),
  estimated_ovr integer check (estimated_ovr between 0 and 100),
  member_user_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(id,session_id,group_id),
  unique(id,group_id),
  unique(session_id,member_user_id),
  foreign key(session_id,group_id) references public.football_sessions(id,group_id),
  foreign key(group_id,member_user_id) references public.group_members(group_id,user_id)
);
create index reserve_players_waiting_idx on public.reserve_players(session_id,created_at);

create table public.reserve_team_players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  session_id uuid not null,
  team_id uuid not null,
  reserve_player_id uuid not null,
  created_at timestamptz not null default now(),
  unique(session_id,reserve_player_id),
  unique(team_id,reserve_player_id),
  foreign key(team_id,session_id,group_id) references public.teams(id,session_id,group_id),
  foreign key(reserve_player_id,session_id,group_id) references public.reserve_players(id,session_id,group_id)
);
create index reserve_team_players_team_idx on public.reserve_team_players(team_id);

alter table public.reserve_players enable row level security;
alter table public.reserve_team_players enable row level security;
create policy reserve_players_read on public.reserve_players for select to authenticated
  using (private.is_member(group_id));
create policy reserve_team_players_read on public.reserve_team_players for select to authenticated
  using (private.is_member(group_id));
revoke all on public.reserve_players,public.reserve_team_players from anon;
grant select on public.reserve_players,public.reserve_team_players to authenticated;

-- Deactivation retains attendance, team assignments, events, and rating history.
-- An active matchday participant cannot be silently removed from a future roster.
create function public.set_group_member_active(p_group_id uuid,p_user_id uuid,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_member public.group_members;
begin
  if p_active is null or not private.is_admin(p_group_id) then raise exception 'Admin permission required'; end if;
  select * into v_member from public.group_members
    where group_id=p_group_id and user_id=p_user_id for update;
  if v_member.id is null then raise exception 'Member not found in this group'; end if;
  if not p_active then
    if p_user_id=auth.uid() then raise exception 'Cannot deactivate your own admin membership'; end if;
    if exists(select 1 from public.group_roles where group_id=p_group_id and user_id=p_user_id
      and role in ('group_admin','super_admin')) then
      raise exception 'Transfer the admin role before deactivation'; end if;
    if exists(select 1 from public.football_attendance a
      join public.football_sessions s on s.id=a.session_id
      where a.group_id=p_group_id and a.user_id=p_user_id and a.status='confirmed'
        and s.status<>'completed' and s.ends_at>now()) or
      exists(select 1 from public.reserve_players r
        join public.reserve_team_players rp on rp.reserve_player_id=r.id
        join public.football_sessions s on s.id=r.session_id
        where r.group_id=p_group_id and r.member_user_id=p_user_id
          and s.status<>'completed' and s.ends_at>now()) then
      raise exception 'Active matchday assignment must be resolved first'; end if;
  end if;
  update public.group_members set status=case when p_active then 'active' else 'inactive' end
    where id=v_member.id;
  insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id)
    values(p_group_id,auth.uid(),case when p_active then 'member_reactivated' else 'member_deactivated' end,
      'profile',p_user_id);
end $$;
revoke all on function public.set_group_member_active(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_group_member_active(uuid,uuid,boolean) to authenticated;
create policy profiles_group_admin_member_read on public.profiles for select to authenticated
  using (exists(select 1 from public.group_members gm
    where gm.user_id=profiles.id and private.is_admin(gm.group_id)));

-- Existing event/discipline rows retain their authenticated player IDs.
alter table public.match_events alter column player_id drop not null;
alter table public.match_events add column reserve_player_id uuid;
alter table public.match_events add constraint match_event_one_player check
  ((player_id is null) <> (reserve_player_id is null));
alter table public.match_events add constraint match_event_reserve_player_fkey
  foreign key(reserve_player_id,group_id) references public.reserve_players(id,group_id);
alter table public.disciplinary_transactions alter column user_id drop not null;
alter table public.disciplinary_transactions add column reserve_player_id uuid;
alter table public.disciplinary_transactions add constraint disciplinary_one_player check
  ((user_id is null) <> (reserve_player_id is null));
alter table public.disciplinary_transactions add constraint disciplinary_reserve_player_fkey
  foreign key(reserve_player_id,group_id) references public.reserve_players(id,group_id);

-- A walk-in is an application identity, never a fabricated auth.users row.
create function public.register_reserve_player(
  p_session_id uuid,p_name text,p_position text,p_ovr integer,p_member_user_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_session public.football_sessions; v_id uuid; v_ovr integer:=p_ovr; v_position text:=p_position;
begin
  select * into v_session from public.football_sessions where id=p_session_id for update;
  if v_session.id is null or not private.is_admin(v_session.group_id) then raise exception 'Admin permission required'; end if;
  if v_session.status='completed' then raise exception 'Session is completed'; end if;
  if length(trim(coalesce(p_name,''))) not between 2 and 100 then raise exception 'Name must be 2 to 100 characters'; end if;
  if p_position is not null and p_position not in ('Goalkeeper','Defender','Midfielder','Forward') then raise exception 'Invalid position'; end if;
  if p_ovr is not null and p_ovr not between 0 and 100 then raise exception 'Rating must be 0 to 100'; end if;
  if p_member_user_id is null and exists(select 1 from public.group_members gm
    join public.profiles p on p.id=gm.user_id
    where gm.group_id=v_session.group_id and gm.status='active'
      and lower(trim(p.full_name))=lower(trim(p_name)))
    then raise exception 'Existing member with this name must be linked'; end if;
  if p_member_user_id is not null then
    if not exists(select 1 from public.group_members where group_id=v_session.group_id and user_id=p_member_user_id and status='active')
      then raise exception 'Member is not active in this group'; end if;
    if not exists(select 1 from public.profiles where id=p_member_user_id and lower(trim(full_name))=lower(trim(p_name)))
      then raise exception 'Use the existing member profile name'; end if;
    if exists(select 1 from public.football_attendance where session_id=p_session_id and user_id=p_member_user_id and status='confirmed')
      then raise exception 'Confirmed players retain their main roster place'; end if;
    if exists(select 1 from public.team_players where session_id=p_session_id and user_id=p_member_user_id)
      then raise exception 'Main team player cannot enter reserve pool'; end if;
    select coalesce(s.overall_ovr,m.initial_ovr,p_ovr) into v_ovr
      from public.group_members m left join public.player_rating_summaries s
        on s.group_id=m.group_id and s.user_id=m.user_id
      where m.group_id=v_session.group_id and m.user_id=p_member_user_id;
    select coalesce(preferred_position,p_position) into v_position from public.profiles where id=p_member_user_id;
  end if;
  insert into public.reserve_players(group_id,session_id,full_name,preferred_position,estimated_ovr,member_user_id,created_by)
    values(v_session.group_id,p_session_id,trim(p_name),v_position,v_ovr,p_member_user_id,auth.uid()) returning id into v_id;
  insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id)
    values(v_session.group_id,auth.uid(),'reserve_player_registered','reserve_player',v_id);
  return v_id;
end $$;

create function public.create_reserve_team(
  p_session_id uuid,p_name text,p_color text,p_player_ids uuid[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_session public.football_sessions; v_team_id uuid; v_player uuid;
begin
  select * into v_session from public.football_sessions where id=p_session_id for update;
  if v_session.id is null or not private.is_admin(v_session.group_id) then raise exception 'Admin permission required'; end if;
  if v_session.status='completed' then raise exception 'Session is completed'; end if;
  if coalesce(array_length(p_player_ids,1),0)<>5 or
     (select count(distinct x) from unnest(p_player_ids) as x)<>5 then
    raise exception 'A reserve team requires five distinct players';
  end if;
  if (select count(*) from public.teams where session_id=p_session_id and kind='main' and status='published')<>4 or
     (select count(*) from public.matches where session_id=p_session_id and match_type='main_main')<6
    then raise exception 'Publish and schedule the original main fixtures first'; end if;
  if length(trim(coalesce(p_name,''))) not between 2 and 60 or coalesce(p_color,'') !~ '^#[0-9A-Fa-f]{6}$'
    then raise exception 'Invalid team name or color'; end if;
  if (select count(*) from public.reserve_players where session_id=p_session_id and id=any(p_player_ids))<>5
    then raise exception 'Reserve player is not in this session'; end if;
  if exists(select 1 from public.reserve_players r join public.football_attendance a
    on a.session_id=r.session_id and a.user_id=r.member_user_id and a.status='confirmed'
    where r.id=any(p_player_ids)) then raise exception 'Confirmed player cannot join reserve team'; end if;
  insert into public.teams(group_id,session_id,name,color,status,kind)
    values(v_session.group_id,p_session_id,trim(p_name),trim(p_color),'published','reserve') returning id into v_team_id;
  foreach v_player in array p_player_ids loop
    insert into public.reserve_team_players(group_id,session_id,team_id,reserve_player_id)
      values(v_session.group_id,p_session_id,v_team_id,v_player);
  end loop;
  insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id)
    values(v_session.group_id,auth.uid(),'reserve_team_created','team',v_team_id);
  return v_team_id;
end $$;

create function public.create_reserve_pair(
  p_session_id uuid,p_first_name text,p_first_color text,p_first_players uuid[],
  p_second_name text,p_second_color text,p_second_players uuid[]
) returns uuid[] language plpgsql security definer set search_path='' as $$
declare v_first uuid; v_second uuid;
begin
  if coalesce(array_length(p_first_players,1),0)<>5 or coalesce(array_length(p_second_players,1),0)<>5 or
    (select count(distinct x) from unnest(p_first_players || p_second_players) as x)<>10
    then raise exception 'Two complete reserve teams require ten distinct players'; end if;
  v_first:=public.create_reserve_team(p_session_id,p_first_name,p_first_color,p_first_players);
  v_second:=public.create_reserve_team(p_session_id,p_second_name,p_second_color,p_second_players);
  return array[v_first,v_second];
end $$;

-- The main round robin still uses only the original four published main teams.
create or replace function public.schedule_matches(p_session_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_group uuid; v_teams uuid[]; i integer; j integer; n integer:=0;
begin
 select group_id into v_group from public.football_sessions where id=p_session_id for update;
 if not private.is_admin(v_group) then raise exception 'Admin permission required'; end if;
 if exists(select 1 from public.matches where session_id=p_session_id) then raise exception 'Matches already scheduled'; end if;
 select array_agg(id order by name) into v_teams from public.teams
   where session_id=p_session_id and status='published' and kind='main';
 if coalesce(array_length(v_teams,1),0)<>4 then raise exception 'Publish four main teams first'; end if;
 for i in 1..3 loop for j in i+1..4 loop
  n:=n+1;
  insert into public.matches(group_id,session_id,home_team_id,away_team_id,order_no,match_type,duration_seconds,created_by)
    values(v_group,p_session_id,v_teams[i],v_teams[j],n,'main_main',600,auth.uid());
 end loop; end loop;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id)
   values(v_group,auth.uid(),'matches_scheduled','football_session',p_session_id);
end $$;

-- Order is sequential, so two fixtures cannot occupy the same slot. Starting an
-- overlapping live/paused fixture remains blocked by set_match_state.
create function public.create_additional_match(
  p_session_id uuid,p_type text,p_home_team_id uuid,p_away_team_id uuid,
  p_position integer,p_head_referee uuid,p_acknowledge_main_delay boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_session public.football_sessions; v_home public.teams; v_away public.teams;
  v_count integer; v_main_after integer; v_match_id uuid;
begin
  select * into v_session from public.football_sessions where id=p_session_id for update;
  if v_session.id is null or not private.is_admin(v_session.group_id) then raise exception 'Admin permission required'; end if;
  if v_session.status='completed' then raise exception 'Session is completed'; end if;
  if (select count(*) from public.matches where session_id=p_session_id and match_type='main_main')<6
    then raise exception 'Schedule the original main fixtures first'; end if;
  if ((select coalesce(sum(duration_seconds),0) from public.matches where session_id=p_session_id) +
     (case when p_type='main_main' then 600 else 480 end)) >
     extract(epoch from (v_session.ends_at-v_session.starts_at))
    then raise exception 'Not enough session time for the full fixture duration'; end if;
  if p_type is null or p_type not in ('main_main','reserve_reserve','reserve_main') or p_home_team_id=p_away_team_id
    then raise exception 'Invalid match type or sides'; end if;
  select * into v_home from public.teams where id=p_home_team_id and session_id=p_session_id and status='published';
  select * into v_away from public.teams where id=p_away_team_id and session_id=p_session_id and status='published';
  if v_home.id is null or v_away.id is null or
    (p_type='main_main' and (v_home.kind<>'main' or v_away.kind<>'main')) or
    (p_type='reserve_reserve' and (v_home.kind<>'reserve' or v_away.kind<>'reserve')) or
    (p_type='reserve_main' and not ((v_home.kind='reserve' and v_away.kind='main') or
      (v_home.kind='main' and v_away.kind='reserve')))
    then raise exception 'Teams are not eligible for this match type'; end if;
  if (case when v_home.kind='main' then
       (select count(*) from public.team_players where team_id=v_home.id)
     else (select count(*) from public.reserve_team_players where team_id=v_home.id) end)<>5 or
     (case when v_away.kind='main' then
       (select count(*) from public.team_players where team_id=v_away.id)
     else (select count(*) from public.reserve_team_players where team_id=v_away.id) end)<>5
    then raise exception 'Both sides require five players'; end if;
  if exists(
    select 1 from public.reserve_team_players rp join public.reserve_players r on r.id=rp.reserve_player_id
    join public.team_players mp on mp.user_id=r.member_user_id and mp.session_id=rp.session_id
    where rp.team_id in (p_home_team_id,p_away_team_id) and mp.team_id in (p_home_team_id,p_away_team_id)
  ) then raise exception 'Player cannot appear on both sides'; end if;
  if p_head_referee is null or not exists(select 1 from public.group_roles gr join public.group_members gm
    on gm.group_id=gr.group_id and gm.user_id=gr.user_id
    where gr.group_id=v_session.group_id and gr.user_id=p_head_referee
      and gr.role in ('group_admin','super_admin') and gm.status='active')
    then raise exception 'An active group admin head referee is required'; end if;
  if exists(select 1 from public.team_players where team_id in (p_home_team_id,p_away_team_id) and user_id=p_head_referee)
    or exists(select 1 from public.reserve_team_players rp join public.reserve_players r on r.id=rp.reserve_player_id
      where rp.team_id in (p_home_team_id,p_away_team_id) and r.member_user_id=p_head_referee)
    then raise exception 'Referee is playing in this match'; end if;
  select count(*) into v_count from public.matches where session_id=p_session_id;
  if p_position is null or p_position<1 or p_position>v_count+1 then raise exception 'Invalid schedule position'; end if;
  if exists(select 1 from public.matches where session_id=p_session_id and status<>'scheduled' and order_no>=p_position)
    then raise exception 'Cannot move a played or active fixture'; end if;
  select count(*) into v_main_after from public.matches where session_id=p_session_id
    and match_type='main_main' and order_no>=p_position;
  if p_type<>'main_main' and v_main_after>0 and p_acknowledge_main_delay is distinct from true
    then raise exception 'Reserve fixture delays a scheduled main fixture; explicit approval required'; end if;
  -- Move from the end to preserve the unique(session_id,order_no) constraint.
  for v_count in reverse v_count..p_position loop
    update public.matches set order_no=v_count+1 where session_id=p_session_id and order_no=v_count;
  end loop;
  insert into public.matches(group_id,session_id,home_team_id,away_team_id,order_no,
    match_type,duration_seconds,priority_acknowledged_by,created_by)
    values(v_session.group_id,p_session_id,p_home_team_id,p_away_team_id,p_position,p_type,
      case when p_type='main_main' then 600 else 480 end,
      case when p_acknowledge_main_delay then auth.uid() else null end,auth.uid())
    returning id into v_match_id;
  insert into public.match_officials(group_id,match_id,user_id,role,assigned_by)
    values(v_session.group_id,v_match_id,p_head_referee,'head',auth.uid());
  insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id,details)
    values(v_session.group_id,auth.uid(),'additional_match_created','match',v_match_id,
      jsonb_build_object('type',p_type,'position',p_position,'main_fixtures_delayed',v_main_after));
  return v_match_id;
end $$;

create or replace function public.reopen_teams(p_session_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_group uuid;
begin
 select group_id into v_group from public.football_sessions where id=p_session_id for update;
 if not private.is_admin(v_group) then raise exception 'Admin permission required'; end if;
 if exists(select 1 from public.teams where session_id=p_session_id and kind='reserve')
   then raise exception 'Reserve teams exist; main assignments are preserved'; end if;
 if exists(select 1 from public.matches where session_id=p_session_id and status<>'scheduled')
   then raise exception 'A match has already started'; end if;
 delete from public.match_officials where match_id in (select id from public.matches where session_id=p_session_id);
 delete from public.matches where session_id=p_session_id;
 update public.teams set status='draft',updated_at=now() where session_id=p_session_id and kind='main';
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id)
   values(v_group,auth.uid(),'teams_reopened','football_session',p_session_id);
end $$;

create or replace function public.set_match_state(p_match_id uuid,p_state public.match_state) returns void
language plpgsql security definer set search_path='' as $$
declare v_match public.matches; v_elapsed integer;
begin
 select * into v_match from public.matches where id=p_match_id for update;
 if v_match.id is null or not private.is_official(p_match_id) then raise exception 'Assigned official required'; end if;
 if not ((v_match.status='scheduled' and p_state='live') or
   (v_match.status='live' and p_state in ('paused','completed')) or
   (v_match.status='paused' and p_state in ('live','completed')))
   then raise exception 'Invalid match transition'; end if;
 if p_state='live' and exists(select 1 from public.matches where session_id=v_match.session_id
   and id<>p_match_id and status in ('live','paused'))
   then raise exception 'Another match is currently active'; end if;
 v_elapsed:=v_match.elapsed_seconds;
 if v_match.status='live' and v_match.started_at is not null then
   v_elapsed:=least(v_match.duration_seconds,v_elapsed+greatest(0,extract(epoch from (now()-v_match.started_at))::integer));
 end if;
 if p_state='live' and v_elapsed>=v_match.duration_seconds then raise exception 'Full time; complete this match'; end if;
 update public.matches set status=p_state,elapsed_seconds=v_elapsed,
   started_at=case when p_state='live' then now() else null end,
   ended_at=case when p_state='completed' then now() else null end where id=p_match_id;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id)
   values(v_match.group_id,auth.uid(),'match_'||p_state::text,'match',p_match_id);
end $$;

-- Legacy order control remains for main-only schedules. Mixed schedules use the
-- explicit fixture creation flow so a reserve cannot silently move main matches.
create or replace function public.set_match_order(p_session_id uuid,p_order uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare v_group uuid; v_count integer; i integer;
begin
 select group_id into v_group from public.football_sessions where id=p_session_id for update;
 if not private.is_admin(v_group) then raise exception 'Admin permission required'; end if;
 if exists(select 1 from public.matches where session_id=p_session_id and match_type<>'main_main')
   then raise exception 'Mixed schedules require explicit reserve fixture approval'; end if;
 if exists(select 1 from public.matches where session_id=p_session_id and status<>'scheduled') then raise exception 'Match order is locked after play starts'; end if;
 select count(*) into v_count from public.matches where session_id=p_session_id;
 if v_count=0 or coalesce(array_length(p_order,1),0)<>v_count or
  (select count(distinct match_id) from unnest(p_order) as x(match_id) where match_id in
    (select id from public.matches where session_id=p_session_id))<>v_count
 then raise exception 'Order must contain each session match exactly once'; end if;
 update public.matches set order_no=order_no+1000 where session_id=p_session_id;
 for i in 1..v_count loop update public.matches set order_no=i where id=p_order[i] and session_id=p_session_id; end loop;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id)
   values(v_group,auth.uid(),'match_order_changed','football_session',p_session_id);
end $$;

revoke all on function public.register_reserve_player(uuid,text,text,integer,uuid),
  public.create_reserve_team(uuid,text,text,uuid[]),
  public.create_reserve_pair(uuid,text,text,uuid[],text,text,uuid[]),
  public.create_additional_match(uuid,text,uuid,uuid,integer,uuid,boolean)
  from public,anon;
grant execute on function public.register_reserve_player(uuid,text,text,integer,uuid),
  public.create_reserve_team(uuid,text,text,uuid[]),
  public.create_reserve_pair(uuid,text,text,uuid[],text,text,uuid[]),
  public.create_additional_match(uuid,text,uuid,uuid,integer,uuid,boolean)
  to authenticated;

create function private.match_side_member(p_match_id uuid,p_team_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.matches m join public.team_players tp
    on tp.session_id=m.session_id and tp.team_id=p_team_id and tp.user_id=p_user_id
    where m.id=p_match_id and p_team_id in (m.home_team_id,m.away_team_id))
  or exists(select 1 from public.matches m join public.reserve_team_players rp
    on rp.session_id=m.session_id and rp.team_id=p_team_id
    join public.reserve_players r on r.id=rp.reserve_player_id and r.member_user_id=p_user_id
    where m.id=p_match_id and p_team_id in (m.home_team_id,m.away_team_id));
$$;
create function private.match_side_walk_in(p_match_id uuid,p_team_id uuid,p_reserve_player_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.matches m join public.reserve_team_players rp
    on rp.session_id=m.session_id and rp.team_id=p_team_id
    join public.reserve_players r on r.id=rp.reserve_player_id and r.member_user_id is null
    where m.id=p_match_id and p_team_id in (m.home_team_id,m.away_team_id)
      and rp.reserve_player_id=p_reserve_player_id);
$$;
revoke all on function private.match_side_member(uuid,uuid,uuid),
  private.match_side_walk_in(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.assign_match_official(p_match_id uuid,p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare v_match public.matches;
begin
 select * into v_match from public.matches where id=p_match_id for update;
 if v_match.id is null or not private.is_admin(v_match.group_id) then raise exception 'Admin permission required'; end if;
 if p_role not in ('head','assistant','supervisor') then raise exception 'Invalid official role'; end if;
 if not exists(select 1 from public.group_roles gr join public.group_members gm
   on gm.group_id=gr.group_id and gm.user_id=gr.user_id
   where gr.group_id=v_match.group_id and gr.user_id=p_user_id
     and gr.role in ('group_admin','super_admin') and gm.status='active')
   then raise exception 'Official must be an active group admin'; end if;
 if private.match_side_member(p_match_id,v_match.home_team_id,p_user_id) or
    private.match_side_member(p_match_id,v_match.away_team_id,p_user_id)
   then raise exception 'Official is playing in this match'; end if;
 if p_role='head' then delete from public.match_officials where match_id=p_match_id and role='head'; end if;
 insert into public.match_officials(group_id,match_id,user_id,role,assigned_by)
   values(v_match.group_id,p_match_id,p_user_id,p_role,auth.uid())
   on conflict(match_id,user_id) do update set role=excluded.role,assigned_by=auth.uid(),assigned_at=now();
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id,details)
   values(v_match.group_id,auth.uid(),'official_assigned','match',p_match_id,
     jsonb_build_object('official_id',p_user_id,'role',p_role));
end $$;

create function private.record_match_event_core(
  p_match_id uuid,p_team_id uuid,p_user_id uuid,p_reserve_player_id uuid,
  p_type public.match_event_type,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_match public.matches; v_event uuid; v_green uuid; v_goals integer;
begin
 select * into v_match from public.matches where id=p_match_id for update;
 if v_match.id is null or not private.is_official(p_match_id) or v_match.status<>'live'
   then raise exception 'Live match and assigned official required'; end if;
 if v_match.elapsed_seconds + greatest(0,extract(epoch from (now()-v_match.started_at))) >= v_match.duration_seconds
   then raise exception 'Full time; match events are closed'; end if;
 if p_idempotency_key is null or p_type is null or
   ((p_user_id is null) = (p_reserve_player_id is null)) or
   p_team_id not in (v_match.home_team_id,v_match.away_team_id)
   then raise exception 'Invalid event input'; end if;
 if p_user_id is not null and not private.match_side_member(p_match_id,p_team_id,p_user_id)
   then raise exception 'Player is not on this match team'; end if;
 if p_reserve_player_id is not null and not private.match_side_walk_in(p_match_id,p_team_id,p_reserve_player_id)
   then raise exception 'Walk-in is not on this match team'; end if;
 select id into v_event from public.match_events where match_id=p_match_id and idempotency_key=p_idempotency_key;
 if v_event is not null then return v_event; end if;
 insert into public.match_events(group_id,match_id,team_id,player_id,reserve_player_id,event_type,recorded_by,idempotency_key)
   values(v_match.group_id,p_match_id,p_team_id,p_user_id,p_reserve_player_id,p_type,auth.uid(),p_idempotency_key)
   returning id into v_event;
 if p_type<>'goal' then
   insert into public.disciplinary_transactions(group_id,match_event_id,user_id,reserve_player_id,card_type,action,created_by)
     values(v_match.group_id,v_event,p_user_id,p_reserve_player_id,p_type,'issued',auth.uid());
 else
   select count(*) into v_goals from public.match_events where match_id=p_match_id and event_type='goal'
     and reversed_at is null and player_id is not distinct from p_user_id
     and reserve_player_id is not distinct from p_reserve_player_id;
   if v_goals=3 and (select green_hat_trick_enabled from public.groups where id=v_match.group_id) then
     insert into public.match_events(group_id,match_id,team_id,player_id,reserve_player_id,event_type,recorded_by,idempotency_key)
       values(v_match.group_id,p_match_id,p_team_id,p_user_id,p_reserve_player_id,'green',auth.uid(),gen_random_uuid())
       returning id into v_green;
     insert into public.disciplinary_transactions(group_id,match_event_id,user_id,reserve_player_id,card_type,action,created_by,reason)
       values(v_match.group_id,v_green,p_user_id,p_reserve_player_id,'green','issued',auth.uid(),'Hat-trick');
   end if;
 end if;
 return v_event;
end $$;
revoke all on function private.record_match_event_core(uuid,uuid,uuid,uuid,public.match_event_type,uuid)
  from public,anon,authenticated;

create or replace function public.record_match_event(
  p_match_id uuid,p_team_id uuid,p_player_id uuid,p_type public.match_event_type,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path='' as $$
begin
  return private.record_match_event_core(p_match_id,p_team_id,p_player_id,null,p_type,p_idempotency_key);
end $$;
create function public.record_walk_in_match_event(
  p_match_id uuid,p_team_id uuid,p_reserve_player_id uuid,p_type public.match_event_type,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path='' as $$
begin
  return private.record_match_event_core(p_match_id,p_team_id,null,p_reserve_player_id,p_type,p_idempotency_key);
end $$;
revoke all on function public.record_walk_in_match_event(uuid,uuid,uuid,public.match_event_type,uuid)
  from public,anon;
grant execute on function public.record_walk_in_match_event(uuid,uuid,uuid,public.match_event_type,uuid)
  to authenticated;

create or replace function public.reverse_match_event(p_event_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_event public.match_events; v_green public.match_events; v_goals integer;
begin
 select * into v_event from public.match_events where id=p_event_id for update;
 if v_event.id is null or not private.is_official(v_event.match_id) or v_event.reversed_at is not null
   then raise exception 'Assigned official and active event required'; end if;
 if exists(select 1 from public.disciplinary_redemptions where green_event_id=p_event_id or red_event_id=p_event_id)
   then raise exception 'Review an authorized redemption before reversing this card'; end if;
 if v_event.event_type='goal' then
   select count(*) into v_goals from public.match_events where match_id=v_event.match_id and event_type='goal'
     and reversed_at is null and player_id is not distinct from v_event.player_id
     and reserve_player_id is not distinct from v_event.reserve_player_id;
   if v_goals=3 and exists(select 1 from public.match_events g
      join public.disciplinary_transactions d on d.match_event_id=g.id and d.reason='Hat-trick' and d.action='issued'
      join public.disciplinary_redemptions r on r.green_event_id=g.id
      where g.match_id=v_event.match_id and g.player_id is not distinct from v_event.player_id
        and g.reserve_player_id is not distinct from v_event.reserve_player_id and g.reversed_at is null)
     then raise exception 'Review green card redemption before reversing this goal'; end if;
 end if;
 update public.match_events set reversed_at=now(),reversed_by=auth.uid() where id=p_event_id;
 if v_event.event_type<>'goal' then
   insert into public.disciplinary_transactions(group_id,match_event_id,user_id,reserve_player_id,card_type,action,created_by)
     values(v_event.group_id,p_event_id,v_event.player_id,v_event.reserve_player_id,v_event.event_type,'reversed',auth.uid());
 elsif v_goals<=3 then
   select e.* into v_green from public.match_events e join public.disciplinary_transactions d
     on d.match_event_id=e.id and d.action='issued' and d.reason='Hat-trick'
     where e.match_id=v_event.match_id and e.player_id is not distinct from v_event.player_id
       and e.reserve_player_id is not distinct from v_event.reserve_player_id
       and e.event_type='green' and e.reversed_at is null limit 1 for update of e;
   if v_green.id is not null then
     update public.match_events set reversed_at=now(),reversed_by=auth.uid() where id=v_green.id;
     insert into public.disciplinary_transactions(group_id,match_event_id,user_id,reserve_player_id,card_type,action,created_by,reason)
       values(v_green.group_id,v_green.id,v_green.player_id,v_green.reserve_player_id,'green','reversed',auth.uid(),'Hat-trick goal reversed');
   end if;
 end if;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id)
   values(v_event.group_id,auth.uid(),'match_event_reversed','match_event',p_event_id);
end $$;

create or replace function public.redeem_green_for_red(p_green_event_id uuid,p_red_event_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_green public.match_events; v_red public.match_events;
begin
 select * into v_green from public.match_events where id=p_green_event_id for update;
 select * into v_red from public.match_events where id=p_red_event_id for update;
 if v_green.id is null or v_red.id is null or v_green.group_id<>v_red.group_id or
   v_green.player_id is distinct from v_red.player_id or
   v_green.reserve_player_id is distinct from v_red.reserve_player_id
   then raise exception 'Cards must belong to the same player and group'; end if;
 if not private.is_admin(v_green.group_id) or not (select green_redemption_enabled from public.groups where id=v_green.group_id)
   then raise exception 'Authorized redemption is disabled'; end if;
 if v_green.event_type<>'green' or v_red.event_type<>'red' or v_green.reversed_at is not null or v_red.reversed_at is not null
   then raise exception 'Active green and red cards required'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'A reason is required'; end if;
 insert into public.disciplinary_redemptions(group_id,green_event_id,red_event_id,authorized_by,reason)
   values(v_green.group_id,p_green_event_id,p_red_event_id,auth.uid(),left(trim(p_reason),500));
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id,details)
   values(v_green.group_id,auth.uid(),'green_card_redeemed','match_event',p_red_event_id,
     jsonb_build_object('green_event_id',p_green_event_id,'reason',left(trim(p_reason),500)));
end $$;

-- The existing community OVR is based only on standard fixtures. Reserve raw
-- events remain available for separate reporting; ratings are not aggregated.
create or replace function public.submit_rating(
  p_match_id uuid,p_ratee_id uuid,p_performance integer,p_teamwork integer,p_effort integer
) returns void language plpgsql security definer set search_path='' as $$
declare v_match public.matches; v_user uuid:=auth.uid(); v_window integer; v_team uuid;
begin
 if v_user is null or v_user=p_ratee_id then raise exception 'Self rating is not allowed'; end if;
 if p_performance not between 1 and 10 or p_teamwork not between 1 and 10 or p_effort not between 1 and 10
   then raise exception 'Ratings must be 1 to 10'; end if;
 select * into v_match from public.matches where id=p_match_id;
 if v_match.id is null or v_match.match_type<>'main_main' then raise exception 'Only standard matches affect community OVR'; end if;
 select rating_window_hours into v_window from public.groups where id=v_match.group_id;
 if v_match.status<>'completed' or now()>v_match.ended_at+make_interval(hours=>v_window)
   then raise exception 'Rating window is closed'; end if;
 select team_id into v_team from public.team_players where session_id=v_match.session_id and user_id=v_user
   and team_id in (v_match.home_team_id,v_match.away_team_id);
 if v_team is null or not exists(select 1 from public.team_players where session_id=v_match.session_id
   and team_id=v_team and user_id=p_ratee_id) then raise exception 'Only participating teammates can rate'; end if;
 insert into public.player_ratings(group_id,match_id,ratee_id,rater_id,performance,teamwork,effort)
   values(v_match.group_id,p_match_id,p_ratee_id,v_user,p_performance,p_teamwork,p_effort);
 insert into public.player_rating_summaries(group_id,user_id,overall_ovr,rating_count)
   select v_match.group_id,p_ratee_id,round(avg((r.performance+r.teamwork+r.effort)/3.0)*10)::integer,count(*)::integer
   from public.player_ratings r join public.matches m on m.id=r.match_id
   where r.group_id=v_match.group_id and r.ratee_id=p_ratee_id and m.match_type='main_main'
   on conflict(group_id,user_id) do update set overall_ovr=excluded.overall_ovr,
     rating_count=excluded.rating_count,updated_at=now();
end $$;
