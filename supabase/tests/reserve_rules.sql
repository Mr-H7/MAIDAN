-- Isolated PostgreSQL/Supabase-compatible test database only. Transaction rolls back.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id,email,raw_user_meta_data)
select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       'reserve-' || n || '@example.invalid',
       jsonb_build_object('full_name','Synthetic ' || n)
from generate_series(1,23) n;

insert into public.groups(id,name,created_by)
values ('10000000-0000-4000-8000-000000000001','Isolated A','00000000-0000-4000-8000-000000000001'),
       ('10000000-0000-4000-8000-000000000002','Isolated B','00000000-0000-4000-8000-000000000022');
insert into public.group_members(group_id,user_id)
select '10000000-0000-4000-8000-000000000001',id from auth.users
where id <> '00000000-0000-4000-8000-000000000022';
insert into public.group_members(group_id,user_id)
values ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000022');
insert into public.group_roles(group_id,user_id,role)
select group_id,user_id,
  case when user_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000023')
    then 'group_admin'::public.group_role else 'player'::public.group_role end
from public.group_members;

insert into public.football_sessions(id,group_id,starts_at,ends_at,capacity,status,roster_locked_at,created_by)
values ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  now()+interval '7 days',now()+interval '7 days 2 hours',20,'locked',now(),
  '00000000-0000-4000-8000-000000000001');
insert into public.football_attendance(group_id,session_id,user_id,status)
select '10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',id,'confirmed'
from auth.users where id between '00000000-0000-4000-8000-000000000002' and '00000000-0000-4000-8000-000000000021';
insert into public.teams(id,group_id,session_id,name,color,status)
select ('40000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 'Main '||n,'#14B8A6','published' from generate_series(1,4) n;
insert into public.team_players(group_id,session_id,team_id,user_id)
select '10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 ('40000000-0000-4000-8000-' || lpad((((n-2)/5)+1)::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
from generate_series(2,21) n;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.schedule_matches('30000000-0000-4000-8000-000000000001');

do $$
declare v_session uuid := '30000000-0000-4000-8000-000000000001';
  v_a uuid := '10000000-0000-4000-8000-000000000001';
  v_b uuid := '10000000-0000-4000-8000-000000000002';
  v_r uuid[] := '{}'; v_r2 uuid[] := '{}'; v_pair uuid[]; v_main uuid;
  v_mix uuid; v_reserve uuid; v_goal uuid; v_card uuid; v_match uuid;
  v_order uuid[];
  v_before text; v_after text; i integer;
begin
  if (select count(*) from public.matches where session_id=v_session and match_type='main_main' and duration_seconds=600)<>6
    then raise exception 'FAIL: six 600-second main fixtures'; end if;
  select array_agg(id order by order_no desc) into v_order from public.matches where session_id=v_session;
  perform public.set_match_order(v_session,v_order);
  if (select array_agg(id order by order_no) from public.matches where session_id=v_session)<>v_order
    then raise exception 'FAIL: main match reordering'; end if;
  perform public.reopen_teams(v_session);
  if exists(select 1 from public.matches where session_id=v_session) or
     (select count(*) from public.team_players where session_id=v_session)<>20
    then raise exception 'FAIL: main-only team reopen regression'; end if;
  perform public.publish_teams(v_session);
  perform public.schedule_matches(v_session);
  select string_agg(id::text||':'||home_team_id::text||':'||away_team_id::text||':'||duration_seconds::text,',' order by order_no)
    into v_before from public.matches where session_id=v_session and match_type='main_main';

  for i in 1..10 loop
    if i=1 then
      begin
        perform public.create_reserve_team(v_session,'Incomplete','#14B8A6',array[]::uuid[]);
        raise exception 'FAIL: incomplete reserve team accepted';
      exception when others then
        if sqlerrm <> 'A reserve team requires five distinct players' then raise; end if;
      end;
    end if;
    if i<=5 then
      v_r:=array_append(v_r,public.register_reserve_player(v_session,'Walk In '||i,null,40+i,null));
    elsif i=10 then
      v_r2:=array_append(v_r2,public.register_reserve_player(v_session,'Synthetic 23',null,50,
        '00000000-0000-4000-8000-000000000023'));
    else
      v_r2:=array_append(v_r2,public.register_reserve_player(v_session,'Walk In '||i,null,40+i,null));
    end if;
  end loop;
  begin
    perform public.register_reserve_player(v_session,'Synthetic 2',null,null,
      '00000000-0000-4000-8000-000000000002');
    raise exception 'FAIL: confirmed member entered reserve pool';
  exception when others then if sqlerrm <> 'Confirmed players retain their main roster place' then raise; end if; end;
  v_pair:=public.create_reserve_pair(v_session,'Reserve One','#14B8A6',v_r,
    'Reserve Two','#3B82F6',v_r2);
  select id into v_main from public.teams where session_id=v_session and kind='main' order by name limit 1;
  v_mix:=public.create_additional_match(v_session,'reserve_main',v_pair[1],v_main,7,
    '00000000-0000-4000-8000-000000000001',false);
  v_reserve:=public.create_additional_match(v_session,'reserve_reserve',v_pair[1],v_pair[2],8,
    '00000000-0000-4000-8000-000000000001',false);
  begin
    perform public.reopen_teams(v_session);
    raise exception 'FAIL: reopened main assignments after reserves';
  exception when others then if sqlerrm <> 'Reserve teams exist; main assignments are preserved' then raise; end if; end;
  begin
    perform public.set_match_order(v_session,v_order);
    raise exception 'FAIL: mixed schedule silently reordered';
  exception when others then if sqlerrm <> 'Mixed schedules require explicit reserve fixture approval' then raise; end if; end;
  if (select count(*) from public.matches where id in (v_mix,v_reserve) and duration_seconds=480)<>2
    then raise exception 'FAIL: reserve fixture duration'; end if;
  select string_agg(id::text||':'||home_team_id::text||':'||away_team_id::text||':'||duration_seconds::text,',' order by order_no)
    into v_after from public.matches where session_id=v_session and match_type='main_main';
  if v_before<>v_after or (select count(*) from public.team_players where team_id=v_main)<>5
    then raise exception 'FAIL: published main fixtures or assignment changed'; end if;
  begin
    perform public.create_additional_match(v_session,'reserve_main',v_pair[1],v_main,1,
      '00000000-0000-4000-8000-000000000001',false);
    raise exception 'FAIL: unapproved main delay';
  exception when others then if sqlerrm <> 'Reserve fixture delays a scheduled main fixture; explicit approval required' then raise; end if; end;
  begin
    perform public.assign_match_official(v_mix,'00000000-0000-4000-8000-000000000002','head');
    raise exception 'FAIL: player referee accepted';
  exception when others then if sqlerrm <> 'Official must be an active group admin' then raise; end if; end;
  begin
    perform public.assign_match_official(v_mix,'00000000-0000-4000-8000-000000000022','head');
    raise exception 'FAIL: other-group referee accepted';
  exception when others then if sqlerrm <> 'Official must be an active group admin' then raise; end if; end;
  begin
    perform public.assign_match_official(v_reserve,'00000000-0000-4000-8000-000000000023','head');
    raise exception 'FAIL: playing admin referee accepted';
  exception when others then if sqlerrm <> 'Official is playing in this match' then raise; end if; end;
  perform public.set_match_state(v_mix,'live');
  begin
    perform public.set_match_state(v_reserve,'live');
    raise exception 'FAIL: simultaneous live fixture';
  exception when others then if sqlerrm <> 'Another match is currently active' then raise; end if; end;
  v_goal:=public.record_walk_in_match_event(v_mix,v_pair[1],v_r[1],'goal',gen_random_uuid());
  perform public.record_walk_in_match_event(v_mix,v_pair[1],v_r[1],'goal',gen_random_uuid());
  perform public.record_walk_in_match_event(v_mix,v_pair[1],v_r[1],'goal',gen_random_uuid());
  if (select count(*) from public.match_events where match_id=v_mix and event_type='green' and reserve_player_id=v_r[1])<>1
    then raise exception 'FAIL: hat-trick green card'; end if;
  v_card:=public.record_walk_in_match_event(v_mix,v_pair[1],v_r[2],'yellow',gen_random_uuid());
  if not exists(select 1 from public.disciplinary_transactions where match_event_id=v_card and reserve_player_id=v_r[2])
    then raise exception 'FAIL: walk-in card transaction'; end if;
  perform public.reverse_match_event(v_goal);
  if (select count(*) from public.match_events where match_id=v_mix and event_type='green' and reversed_at is null)<>0
    then raise exception 'FAIL: green not reversed after goal'; end if;
  perform public.set_match_state(v_mix,'paused');
  perform public.set_match_state(v_mix,'live');
  perform public.set_match_state(v_mix,'completed');
  if (select status from public.matches where id=v_mix)<>'completed' then raise exception 'FAIL: timer state'; end if;
  select id into v_match from public.matches where session_id=v_session and match_type='main_main' order by order_no limit 1;
  perform public.assign_match_official(v_match,'00000000-0000-4000-8000-000000000001','head');
  perform public.set_match_state(v_match,'live');
  perform public.record_match_event(v_match,(select home_team_id from public.matches where id=v_match),
    (select user_id from public.team_players where team_id=(select home_team_id from public.matches where id=v_match) limit 1),
    'goal',gen_random_uuid());
  perform public.set_match_state(v_match,'completed');
  perform set_config('request.jwt.claim.sub',
    (select user_id::text from public.team_players where team_id=(select home_team_id from public.matches where id=v_match) order by user_id limit 1),true);
  perform public.submit_rating(v_match,
    (select user_id from public.team_players where team_id=(select home_team_id from public.matches where id=v_match) order by user_id offset 1 limit 1),8,9,7);
  if (select count(*) from public.player_rating_summaries where group_id=v_a)<>1
    then raise exception 'FAIL: main rating summary'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  raise notice 'PASS: main/reserve durations, roster integrity, referee eligibility, single active match, cards, hat-trick, reversal, timer';
end $$;

-- A normal player cannot mutate roster/fixtures or read another group.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$
begin
  if exists(select 1 from public.groups where id='10000000-0000-4000-8000-000000000002')
    then raise exception 'FAIL: Group B leaked'; end if;
  begin
    perform public.register_reserve_player('30000000-0000-4000-8000-000000000001','Unauthorized',null,null,null);
    raise exception 'FAIL: player created reserve identity';
  exception when others then if sqlerrm <> 'Admin permission required' then raise; end if; end;
  begin
    update public.teams set kind='reserve' where session_id='30000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: player changed team kind';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_additional_match('30000000-0000-4000-8000-000000000001',
      'main_main','40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002',9,
      '00000000-0000-4000-8000-000000000001',false);
    raise exception 'FAIL: player created fixture';
  exception when others then if sqlerrm <> 'Admin permission required' then raise; end if; end;
  begin
    perform public.set_match_state((select id from public.matches where match_type='reserve_reserve' limit 1),'live');
    raise exception 'FAIL: player controlled match';
  exception when others then if sqlerrm <> 'Assigned official required' then raise; end if; end;
  raise notice 'PASS: player mutation and cross-group denials';
end $$;

-- Deactivation is a privileged test fixture change because no member-removal RPC exists.
reset role;
update public.group_members set status='inactive'
where group_id='10000000-0000-4000-8000-000000000001'
  and user_id='00000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.matches where session_id='30000000-0000-4000-8000-000000000001')
    then raise exception 'FAIL: inactive member retained group access'; end if;
  raise notice 'PASS: inactive member loses group read access';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.add_member_by_email('10000000-0000-4000-8000-000000000001','reserve-2@example.invalid');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  if not exists(select 1 from public.matches where session_id='30000000-0000-4000-8000-000000000001')
    then raise exception 'FAIL: reactivated member cannot read'; end if;
  raise notice 'PASS: existing account reactivation restores scoped read access';
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000022',true);
do $$ begin
  begin
    perform public.register_reserve_player('30000000-0000-4000-8000-000000000001','Cross Group',null,null,null);
    raise exception 'FAIL: Group B admin changed Group A';
  exception when others then if sqlerrm <> 'Admin permission required' then raise; end if; end;
  if exists(select 1 from public.reserve_players where group_id='10000000-0000-4000-8000-000000000001')
    then raise exception 'FAIL: Group B admin read reserve identities'; end if;
  raise notice 'PASS: Group B admin denied Group A reserve records and writes';
end $$;

rollback;
