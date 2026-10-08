create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create type public.group_role as enum ('super_admin','group_admin','player');
create type public.booking_state as enum ('pre_registered','confirmed','declined','pending','waitlisted');
create type public.maqraa_state as enum ('scheduled','active','closed');
create type public.football_state as enum ('open','locked','completed');
create type public.team_state as enum ('draft','published');
create type public.match_state as enum ('scheduled','live','paused','completed');
create type public.match_event_type as enum ('goal','yellow','red','green');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (length(trim(full_name)) between 2 and 100),
 preferred_position text check (preferred_position in ('Goalkeeper','Defender','Midfielder','Forward')),
 self_ovr integer check (self_ovr between 0 and 100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.groups (
 id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 2 and 100),
 timezone text not null default 'Africa/Cairo', capacity integer not null default 20 check (capacity between 2 and 100),
 rating_window_hours integer not null default 24 check (rating_window_hours between 1 and 168),
 green_hat_trick_enabled boolean not null default true,
 green_redemption_enabled boolean not null default false,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.group_members (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'active' check (status in ('active','inactive')),
 initial_ovr integer check (initial_ovr between 0 and 100),
 joined_at timestamptz not null default now(), unique(group_id,user_id), unique(id,group_id)
);
create table public.group_roles (
 id uuid primary key default gen_random_uuid(), group_id uuid not null, user_id uuid not null,
 role public.group_role not null default 'player', granted_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), unique(group_id,user_id),
 foreign key(group_id,user_id) references public.group_members(group_id,user_id) on delete cascade
);
create table private.super_admins (user_id uuid primary key references public.profiles(id) on delete cascade);
create table public.football_sessions (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
 starts_at timestamptz not null, ends_at timestamptz not null, venue text,
 capacity integer not null check(capacity between 2 and 100), status public.football_state not null default 'open',
 roster_locked_at timestamptz, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 check(ends_at>starts_at), unique(id,group_id), unique(group_id,starts_at)
);
create table public.maqraa_sessions (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
 football_session_id uuid, title text not null, starts_at timestamptz not null,
 status public.maqraa_state not null default 'scheduled', qr_expires_at timestamptz,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(id,group_id), unique(group_id,starts_at),
 foreign key(football_session_id,group_id) references public.football_sessions(id,group_id)
);
create table private.maqraa_tokens (
 session_id uuid primary key references public.maqraa_sessions(id) on delete cascade,
 token_hash bytea not null unique, expires_at timestamptz not null
);
create table public.maqraa_attendance (
 id uuid primary key default gen_random_uuid(), group_id uuid not null, session_id uuid not null,
 user_id uuid not null references public.profiles(id), checked_in_at timestamptz not null default now(),
 source text not null default 'qr' check(source in ('qr','manual')),
 corrected_by uuid references public.profiles(id), unique(session_id,user_id),
 foreign key(session_id,group_id) references public.maqraa_sessions(id,group_id),
 foreign key(group_id,user_id) references public.group_members(group_id,user_id)
);
create table public.football_attendance (
 id uuid primary key default gen_random_uuid(), group_id uuid not null, session_id uuid not null,
 user_id uuid not null references public.profiles(id), status public.booking_state not null default 'pending',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id), unique(session_id,user_id),
 foreign key(session_id,group_id) references public.football_sessions(id,group_id),
 foreign key(group_id,user_id) references public.group_members(group_id,user_id)
);
create table public.teams (
 id uuid primary key default gen_random_uuid(), group_id uuid not null, session_id uuid not null,
 name text not null, color text not null, status public.team_state not null default 'draft',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,group_id), unique(id,session_id,group_id), unique(session_id,name),
 foreign key(session_id,group_id) references public.football_sessions(id,group_id)
);
create table public.team_players (
 id uuid primary key default gen_random_uuid(), group_id uuid not null, session_id uuid not null,
 team_id uuid not null, user_id uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(session_id,user_id), unique(team_id,user_id),
 foreign key(team_id,session_id,group_id) references public.teams(id,session_id,group_id),
 foreign key(session_id,group_id) references public.football_sessions(id,group_id),
 foreign key(group_id,user_id) references public.group_members(group_id,user_id)
);
create table public.matches (
 id uuid primary key default gen_random_uuid(), group_id uuid not null, session_id uuid not null,
 home_team_id uuid not null, away_team_id uuid not null, order_no integer not null check(order_no>0),
 status public.match_state not null default 'scheduled', duration_seconds integer not null default 600 check(duration_seconds between 60 and 3600),
 started_at timestamptz, elapsed_seconds integer not null default 0 check(elapsed_seconds>=0), ended_at timestamptz,
 created_at timestamptz not null default now(), unique(id,group_id), unique(session_id,order_no),
 check(home_team_id<>away_team_id),
 foreign key(session_id,group_id) references public.football_sessions(id,group_id),
 constraint matches_home_team_id_fkey foreign key(home_team_id,session_id,group_id) references public.teams(id,session_id,group_id),
 constraint matches_away_team_id_fkey foreign key(away_team_id,session_id,group_id) references public.teams(id,session_id,group_id)
);
create table public.match_officials (
 id uuid primary key default gen_random_uuid(), group_id uuid not null, match_id uuid not null,
 user_id uuid not null references public.profiles(id), role text not null check(role in ('head','assistant','supervisor')),
 assigned_by uuid not null references public.profiles(id), assigned_at timestamptz not null default now(),
 unique(match_id,user_id), unique(match_id,role,user_id),
 foreign key(match_id,group_id) references public.matches(id,group_id),
 foreign key(group_id,user_id) references public.group_members(group_id,user_id)
);
create unique index match_one_head_referee on public.match_officials(match_id) where role='head';
create table public.match_events (
 id uuid primary key default gen_random_uuid(), group_id uuid not null, match_id uuid not null,
 team_id uuid not null, player_id uuid not null references public.profiles(id),
 event_type public.match_event_type not null, occurred_at timestamptz not null default now(),
 recorded_by uuid not null references public.profiles(id), idempotency_key uuid not null,
 reversed_at timestamptz, reversed_by uuid references public.profiles(id),
 unique(match_id,idempotency_key), unique(id,group_id),
 foreign key(match_id,group_id) references public.matches(id,group_id),
 foreign key(team_id,group_id) references public.teams(id,group_id),
 foreign key(group_id,player_id) references public.group_members(group_id,user_id)
);
create table public.player_ratings (
 id uuid primary key default gen_random_uuid(), group_id uuid not null, match_id uuid not null,
 ratee_id uuid not null references public.profiles(id), rater_id uuid not null references public.profiles(id),
 performance integer not null check(performance between 1 and 10), teamwork integer not null check(teamwork between 1 and 10),
 effort integer not null check(effort between 1 and 10), created_at timestamptz not null default now(),
 unique(match_id,ratee_id,rater_id), check(ratee_id<>rater_id),
 foreign key(match_id,group_id) references public.matches(id,group_id)
);
create table public.player_rating_summaries (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
 user_id uuid not null references public.profiles(id), overall_ovr integer not null check(overall_ovr between 0 and 100),
 rating_count integer not null check(rating_count>=0), updated_at timestamptz not null default now(),
 unique(group_id,user_id), foreign key(group_id,user_id) references public.group_members(group_id,user_id)
);
create table public.disciplinary_transactions (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id),
 match_event_id uuid not null, user_id uuid not null references public.profiles(id),
 card_type public.match_event_type not null check(card_type in ('yellow','red','green')),
 action text not null check(action in ('issued','reversed','redeemed')),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 reason text, unique(match_event_id,action), foreign key(match_event_id,group_id) references public.match_events(id,group_id)
);
create table public.disciplinary_redemptions (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id),
 green_event_id uuid not null, red_event_id uuid not null,
 authorized_by uuid not null references public.profiles(id), reason text not null,
 created_at timestamptz not null default now(), unique(green_event_id), unique(red_event_id),
 foreign key(green_event_id,group_id) references public.match_events(id,group_id),
 foreign key(red_event_id,group_id) references public.match_events(id,group_id)
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id),
 actor_id uuid not null references public.profiles(id), action text not null, entity_type text not null,
 entity_id uuid not null, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index group_members_user_idx on public.group_members(user_id,status);
create index group_roles_user_idx on public.group_roles(user_id,role);
create index maqraa_sessions_group_time_idx on public.maqraa_sessions(group_id,starts_at desc);
create index football_sessions_group_time_idx on public.football_sessions(group_id,starts_at desc);
create index football_attendance_roster_idx on public.football_attendance(session_id,status);
create index matches_session_idx on public.matches(session_id,order_no);
create index match_events_timeline_idx on public.match_events(match_id,occurred_at);
create index player_ratings_ratee_idx on public.player_ratings(group_id,ratee_id);
create index audit_logs_group_time_idx on public.audit_logs(group_id,created_at desc);

create function private.is_member(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.group_members m where m.group_id=p_group and m.user_id=(select auth.uid()) and m.status='active')
$$;
create function private.is_admin(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (
  exists(select 1 from private.super_admins s where s.user_id=(select auth.uid())) or
  exists(select 1 from public.group_roles r join public.group_members m on m.group_id=r.group_id and m.user_id=r.user_id where r.group_id=p_group and r.user_id=(select auth.uid()) and r.role in ('group_admin','super_admin') and m.status='active'))
$$;
create function private.is_official(p_match uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
  select 1 from public.match_officials o join public.matches ma on ma.id=o.match_id
  where o.match_id=p_match and o.user_id=(select auth.uid()) and private.is_admin(ma.group_id))
$$;
create function private.shares_group(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_user=(select auth.uid()) or exists(
  select 1 from public.group_members a join public.group_members b on a.group_id=b.group_id
  where a.user_id=(select auth.uid()) and b.user_id=p_user and a.status='active' and b.status='active')
$$;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_member(uuid),private.is_admin(uuid),private.is_official(uuid),private.shares_group(uuid) to authenticated;

create function private.make_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
 v_name:=left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),nullif(split_part(new.email,'@',1),''),'Player'),100);
 if length(v_name)<2 then v_name:='Player '||left(new.id::text,8); end if;
 insert into public.profiles(id,full_name) values(new.id,v_name);
 return new;
end $$;
create trigger auth_user_profile after insert on auth.users for each row execute function private.make_profile();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_roles enable row level security;
alter table public.maqraa_sessions enable row level security;
alter table public.maqraa_attendance enable row level security;
alter table public.football_sessions enable row level security;
alter table public.football_attendance enable row level security;
alter table public.teams enable row level security;
alter table public.team_players enable row level security;
alter table public.matches enable row level security;
alter table public.match_officials enable row level security;
alter table public.match_events enable row level security;
alter table public.player_ratings enable row level security;
alter table public.player_rating_summaries enable row level security;
alter table public.disciplinary_transactions enable row level security;
alter table public.disciplinary_redemptions enable row level security;
alter table public.audit_logs enable row level security;
alter table private.super_admins enable row level security;
alter table private.maqraa_tokens enable row level security;

create policy profiles_read on public.profiles for select to authenticated using(private.shares_group(id));
create policy profiles_self_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy groups_read on public.groups for select to authenticated using(private.is_member(id));
create policy members_read on public.group_members for select to authenticated using(private.is_member(group_id));
create policy roles_read on public.group_roles for select to authenticated using(private.is_admin(group_id) or user_id=(select auth.uid()));
create policy maqraa_read on public.maqraa_sessions for select to authenticated using(private.is_member(group_id));
create policy maqraa_attendance_read on public.maqraa_attendance for select to authenticated using(private.is_admin(group_id) or user_id=(select auth.uid()));
create policy football_read on public.football_sessions for select to authenticated using(private.is_member(group_id));
create policy football_attendance_read on public.football_attendance for select to authenticated using(private.is_member(group_id));
create policy teams_read on public.teams for select to authenticated using(private.is_admin(group_id) or (status='published' and private.is_member(group_id)));
create policy team_players_read on public.team_players for select to authenticated using(private.is_admin(group_id) or (private.is_member(group_id) and exists(select 1 from public.teams t where t.id=team_id and t.status='published')));
create policy matches_read on public.matches for select to authenticated using(private.is_member(group_id));
create policy match_officials_read on public.match_officials for select to authenticated using(private.is_member(group_id));
create policy match_events_read on public.match_events for select to authenticated using(private.is_member(group_id));
create policy ratings_read on public.player_ratings for select to authenticated using(private.is_admin(group_id) or ratee_id=(select auth.uid()) or rater_id=(select auth.uid()));
create policy summaries_read on public.player_rating_summaries for select to authenticated using(private.is_member(group_id));
create policy disciplinary_read on public.disciplinary_transactions for select to authenticated using(private.is_member(group_id));
create policy redemptions_read on public.disciplinary_redemptions for select to authenticated using(private.is_member(group_id));
create policy audit_read on public.audit_logs for select to authenticated using(private.is_admin(group_id));

revoke all on all tables in schema public from anon,authenticated;
grant select on public.profiles,public.groups,public.group_members,public.group_roles,public.maqraa_sessions,public.maqraa_attendance,public.football_sessions,public.football_attendance,public.teams,public.team_players,public.matches,public.match_officials,public.match_events,public.player_ratings,public.player_rating_summaries,public.disciplinary_transactions,public.disciplinary_redemptions,public.audit_logs to authenticated;
grant update(full_name,preferred_position,self_ovr) on public.profiles to authenticated;

create function public.create_group(p_name text) returns public.groups language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_group public.groups;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if length(trim(p_name)) not between 2 and 100 then raise exception 'Invalid group name'; end if;
 insert into public.groups(name,created_by) values(trim(p_name),v_user) returning * into v_group;
 insert into public.group_members(group_id,user_id) values(v_group.id,v_user);
 insert into public.group_roles(group_id,user_id,role,granted_by) values(v_group.id,v_user,'group_admin',v_user);
 return v_group;
end $$;
create function public.add_member_by_email(p_group_id uuid,p_email text) returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
 if not private.is_admin(p_group_id) then raise exception 'Admin permission required'; end if;
 select id into v_user from auth.users where lower(email)=lower(trim(p_email));
 if v_user is null then raise exception 'Account not found'; end if;
 insert into public.group_members(group_id,user_id) values(p_group_id,v_user) on conflict(group_id,user_id) do update set status='active';
 insert into public.group_roles(group_id,user_id,role,granted_by) values(p_group_id,v_user,'player',auth.uid()) on conflict(group_id,user_id) do nothing;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id) values(p_group_id,auth.uid(),'member_added','profile',v_user);
end $$;
create function public.create_weekly_sessions(p_group_id uuid,p_maqraa_start timestamptz,p_football_start timestamptz,p_venue text) returns void language plpgsql security definer set search_path='' as $$
declare v_zone text; v_capacity integer; v_football uuid;
begin
 if not private.is_admin(p_group_id) then raise exception 'Admin permission required'; end if;
 select timezone,capacity into v_zone,v_capacity from public.groups where id=p_group_id;
 if extract(isodow from p_maqraa_start at time zone v_zone)<>2 then raise exception 'Maqraa must be on Tuesday in group timezone'; end if;
 if extract(isodow from p_football_start at time zone v_zone)<>5 then raise exception 'Football must be on Friday in group timezone'; end if;
 if p_football_start<=p_maqraa_start or p_football_start>p_maqraa_start+interval '5 days' then raise exception 'Friday session must follow Tuesday Maqraa'; end if;
 insert into public.football_sessions(group_id,starts_at,ends_at,venue,capacity,created_by)
 values(p_group_id,p_football_start,p_football_start+interval '2 hours',nullif(trim(p_venue),''),v_capacity,auth.uid()) returning id into v_football;
 insert into public.maqraa_sessions(group_id,football_session_id,title,starts_at,created_by)
 values(p_group_id,v_football,'Weekly Maqraa',p_maqraa_start,auth.uid());
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id) values(p_group_id,auth.uid(),'weekly_sessions_created','football_session',v_football);
end $$;
create function public.set_maqraa_status(p_session_id uuid,p_status public.maqraa_state) returns void language plpgsql security definer set search_path='' as $$
declare v_group uuid; v_current public.maqraa_state;
begin
 select group_id,status into v_group,v_current from public.maqraa_sessions where id=p_session_id for update;
 if not private.is_admin(v_group) then raise exception 'Admin permission required'; end if;
 if not ((v_current='scheduled' and p_status='active') or (v_current='active' and p_status='closed')) then raise exception 'Invalid status transition'; end if;
 update public.maqraa_sessions set status=p_status where id=p_session_id;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id) values(v_group,auth.uid(),'maqraa_'||p_status::text,'maqraa_session',p_session_id);
end $$;
create function public.rotate_maqraa_token(p_session_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare v_group uuid; v_status public.maqraa_state; v_token text; v_expiry timestamptz:=now()+interval '2 minutes';
begin
 select group_id,status into v_group,v_status from public.maqraa_sessions where id=p_session_id for update;
 if not private.is_admin(v_group) or v_status<>'active' then raise exception 'Active session and admin permission required'; end if;
 v_token=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.maqraa_tokens(session_id,token_hash,expires_at) values(p_session_id,extensions.digest(v_token,'sha256'),v_expiry)
 on conflict(session_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
 update public.maqraa_sessions set qr_expires_at=v_expiry where id=p_session_id;
 return v_token;
end $$;
create function public.check_in_maqraa(p_token text) returns void language plpgsql security definer set search_path='' as $$
declare v_session public.maqraa_sessions; v_user uuid:=auth.uid();
begin
 if v_user is null or length(p_token)<>64 then raise exception 'Invalid QR token'; end if;
 select s.* into v_session from private.maqraa_tokens t join public.maqraa_sessions s on s.id=t.session_id
 where t.token_hash=extensions.digest(p_token,'sha256') and t.expires_at>now() for update of s;
 if v_session.id is null or v_session.status<>'active' then raise exception 'Invalid or expired QR token'; end if;
 if not private.is_member(v_session.group_id) then raise exception 'Group membership required'; end if;
 insert into public.maqraa_attendance(group_id,session_id,user_id) values(v_session.group_id,v_session.id,v_user);
 if v_session.football_session_id is not null then
  insert into public.football_attendance(group_id,session_id,user_id,status,updated_by)
  values(v_session.group_id,v_session.football_session_id,v_user,'pre_registered',v_user)
  on conflict(session_id,user_id) do nothing;
 end if;
end $$;
create function public.set_booking(p_session_id uuid,p_state public.booking_state) returns void language plpgsql security definer set search_path='' as $$
declare v_session public.football_sessions; v_user uuid:=auth.uid(); v_state public.booking_state:=p_state;
begin
 if v_user is null or p_state not in ('confirmed','declined') then raise exception 'Invalid attendance choice'; end if;
 select * into v_session from public.football_sessions where id=p_session_id for update;
 if v_session.id is null or not private.is_member(v_session.group_id) or v_session.status<>'open' or v_session.starts_at<=now() then raise exception 'Booking is closed'; end if;
 if v_state='confirmed' and (select count(*) from public.football_attendance where session_id=p_session_id and status='confirmed' and user_id<>v_user)>=v_session.capacity then v_state='waitlisted'; end if;
 insert into public.football_attendance(group_id,session_id,user_id,status,updated_by) values(v_session.group_id,p_session_id,v_user,v_state,v_user)
 on conflict(session_id,user_id) do update set status=excluded.status,updated_at=now(),updated_by=v_user;
end $$;
create function public.admin_set_booking(p_session_id uuid,p_user_id uuid,p_state public.booking_state) returns void language plpgsql security definer set search_path='' as $$
declare v_session public.football_sessions;
begin
 select * into v_session from public.football_sessions where id=p_session_id for update;
 if not private.is_admin(v_session.group_id) then raise exception 'Admin permission required'; end if;
 if v_session.status<>'open' then raise exception 'Roster locked'; end if;
 if not exists(select 1 from public.group_members where group_id=v_session.group_id and user_id=p_user_id and status='active') then raise exception 'Player is not an active group member'; end if;
 if p_state='confirmed' and (select count(*) from public.football_attendance where session_id=p_session_id and status='confirmed' and user_id<>p_user_id)>=v_session.capacity then raise exception 'Capacity reached'; end if;
 insert into public.football_attendance(group_id,session_id,user_id,status,updated_by) values(v_session.group_id,p_session_id,p_user_id,p_state,auth.uid())
 on conflict(session_id,user_id) do update set status=excluded.status,updated_at=now(),updated_by=auth.uid();
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id,details) values(v_session.group_id,auth.uid(),'attendance_updated','football_session',p_session_id,jsonb_build_object('user_id',p_user_id,'status',p_state));
end $$;
create function public.lock_roster(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_session public.football_sessions;
begin
 select * into v_session from public.football_sessions where id=p_session_id for update;
 if not private.is_admin(v_session.group_id) or v_session.status<>'open' then raise exception 'Open session and admin permission required'; end if;
 update public.football_sessions set status='locked',roster_locked_at=now() where id=p_session_id;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id) values(v_session.group_id,auth.uid(),'roster_locked','football_session',p_session_id);
end $$;
create function public.save_teams(p_session_id uuid,p_assignments jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v_session public.football_sessions; v_team jsonb; v_player text; v_team_id uuid; v_count integer:=0;
begin
 select * into v_session from public.football_sessions where id=p_session_id for update;
 if not private.is_admin(v_session.group_id) or v_session.status<>'locked' then raise exception 'Locked roster and admin permission required'; end if;
 if exists(select 1 from public.teams where session_id=p_session_id and status='published') then raise exception 'Published teams cannot be overwritten'; end if;
 if coalesce(jsonb_typeof(p_assignments),'null')<>'array' then raise exception 'Four teams required'; end if;
 if jsonb_array_length(p_assignments)<>4 then raise exception 'Four teams required'; end if;
 if (select count(*) from public.football_attendance where session_id=p_session_id and status='confirmed')<>20 then raise exception 'Exactly 20 confirmed players required'; end if;
 delete from public.team_players where session_id=p_session_id;
 delete from public.teams where session_id=p_session_id;
 for v_team in select * from jsonb_array_elements(p_assignments) loop
  if coalesce(jsonb_typeof(v_team->'userIds'),'null')<>'array' then raise exception 'Each team requires five players'; end if;
  if jsonb_array_length(v_team->'userIds')<>5 then raise exception 'Each team requires five players'; end if;
  insert into public.teams(group_id,session_id,name,color) values(v_session.group_id,p_session_id,left(v_team->>'name',60),left(v_team->>'color',20)) returning id into v_team_id;
  for v_player in select jsonb_array_elements_text(v_team->'userIds') loop
   if not exists(select 1 from public.football_attendance where session_id=p_session_id and user_id=v_player::uuid and status='confirmed') then raise exception 'Only confirmed players can join teams'; end if;
   insert into public.team_players(group_id,session_id,team_id,user_id) values(v_session.group_id,p_session_id,v_team_id,v_player::uuid);
   v_count:=v_count+1;
  end loop;
 end loop;
 if v_count<>20 then raise exception 'Incomplete team assignment'; end if;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id) values(v_session.group_id,auth.uid(),'teams_saved','football_session',p_session_id);
end $$;
create function public.publish_teams(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_group uuid;
begin
 select group_id into v_group from public.football_sessions where id=p_session_id;
 if not private.is_admin(v_group) then raise exception 'Admin permission required'; end if;
 if (select count(*) from public.teams where session_id=p_session_id)<>4 or (select count(*) from public.team_players where session_id=p_session_id)<>20 then raise exception 'Save complete teams first'; end if;
 update public.teams set status='published',updated_at=now() where session_id=p_session_id;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id) values(v_group,auth.uid(),'teams_published','football_session',p_session_id);
end $$;
create function public.schedule_matches(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_group uuid; v_teams uuid[]; i integer; j integer; n integer:=0;
begin
 select group_id into v_group from public.football_sessions where id=p_session_id for update;
 if not private.is_admin(v_group) then raise exception 'Admin permission required'; end if;
 if exists(select 1 from public.matches where session_id=p_session_id) then raise exception 'Matches already scheduled'; end if;
 select array_agg(id order by name) into v_teams from public.teams where session_id=p_session_id and status='published';
 if coalesce(array_length(v_teams,1),0)<>4 then raise exception 'Publish four teams first'; end if;
 for i in 1..3 loop for j in i+1..4 loop
  n:=n+1; insert into public.matches(group_id,session_id,home_team_id,away_team_id,order_no) values(v_group,p_session_id,v_teams[i],v_teams[j],n);
 end loop; end loop;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id) values(v_group,auth.uid(),'matches_scheduled','football_session',p_session_id);
end $$;
create function public.assign_match_official(p_match_id uuid,p_user_id uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
declare v_match public.matches;
begin
 select * into v_match from public.matches where id=p_match_id for update;
 if not private.is_admin(v_match.group_id) then raise exception 'Admin permission required'; end if;
 if p_role not in ('head','assistant','supervisor') then raise exception 'Invalid official role'; end if;
 if not exists(select 1 from public.group_roles where group_id=v_match.group_id and user_id=p_user_id and role in ('group_admin','super_admin')) then raise exception 'Official must be a group admin'; end if;
 if exists(select 1 from public.team_players where session_id=v_match.session_id and user_id=p_user_id and team_id in (v_match.home_team_id,v_match.away_team_id)) then raise exception 'Official is playing in this match'; end if;
 if p_role='head' then delete from public.match_officials where match_id=p_match_id and role='head'; end if;
 insert into public.match_officials(group_id,match_id,user_id,role,assigned_by) values(v_match.group_id,p_match_id,p_user_id,p_role,auth.uid())
 on conflict(match_id,user_id) do update set role=excluded.role,assigned_by=auth.uid(),assigned_at=now();
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id,details) values(v_match.group_id,auth.uid(),'official_assigned','match',p_match_id,jsonb_build_object('official_id',p_user_id,'role',p_role));
end $$;
create function public.set_match_state(p_match_id uuid,p_state public.match_state) returns void language plpgsql security definer set search_path='' as $$
declare v_match public.matches; v_elapsed integer;
begin
 select * into v_match from public.matches where id=p_match_id for update;
 if not private.is_official(p_match_id) then raise exception 'Assigned official required'; end if;
 if not ((v_match.status='scheduled' and p_state='live') or (v_match.status='live' and p_state in ('paused','completed')) or (v_match.status='paused' and p_state in ('live','completed'))) then raise exception 'Invalid match transition'; end if;
 if v_match.status='scheduled' and p_state='live' and exists(
  select 1 from public.matches where session_id=v_match.session_id and id<>p_match_id and status in ('live','paused')
 ) then raise exception 'Another match is currently active'; end if;
 v_elapsed:=v_match.elapsed_seconds;
 if v_match.status='live' and v_match.started_at is not null then v_elapsed:=least(v_match.duration_seconds,v_elapsed+greatest(0,extract(epoch from (now()-v_match.started_at))::integer)); end if;
 update public.matches set status=p_state,elapsed_seconds=v_elapsed,started_at=case when p_state='live' then now() else null end,ended_at=case when p_state='completed' then now() else null end where id=p_match_id;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id) values(v_match.group_id,auth.uid(),'match_'||p_state::text,'match',p_match_id);
end $$;
create function public.record_match_event(p_match_id uuid,p_team_id uuid,p_player_id uuid,p_type public.match_event_type,p_idempotency_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_match public.matches; v_event uuid; v_green uuid;
begin
 select * into v_match from public.matches where id=p_match_id for update;
 if not private.is_official(p_match_id) or v_match.status<>'live' then raise exception 'Live match and assigned official required'; end if;
 if p_team_id not in (v_match.home_team_id,v_match.away_team_id) or not exists(select 1 from public.team_players where session_id=v_match.session_id and team_id=p_team_id and user_id=p_player_id) then raise exception 'Player is not on this match team'; end if;
 select id into v_event from public.match_events where match_id=p_match_id and idempotency_key=p_idempotency_key;
 if v_event is not null then return v_event; end if;
 insert into public.match_events(group_id,match_id,team_id,player_id,event_type,recorded_by,idempotency_key)
 values(v_match.group_id,p_match_id,p_team_id,p_player_id,p_type,auth.uid(),p_idempotency_key)
 returning id into v_event;
 if p_type<>'goal' then
  insert into public.disciplinary_transactions(group_id,match_event_id,user_id,card_type,action,created_by)
  values(v_match.group_id,v_event,p_player_id,p_type,'issued',auth.uid()) on conflict(match_event_id,action) do nothing;
 elsif (select green_hat_trick_enabled from public.groups where id=v_match.group_id) and
  (select count(*) from public.match_events where match_id=p_match_id and player_id=p_player_id and event_type='goal' and reversed_at is null)=3 then
  insert into public.match_events(group_id,match_id,team_id,player_id,event_type,recorded_by,idempotency_key)
  values(v_match.group_id,p_match_id,p_team_id,p_player_id,'green',auth.uid(),gen_random_uuid()) returning id into v_green;
  insert into public.disciplinary_transactions(group_id,match_event_id,user_id,card_type,action,created_by,reason)
  values(v_match.group_id,v_green,p_player_id,'green','issued',auth.uid(),'Hat-trick');
 end if;
 return v_event;
end $$;
create function public.reverse_match_event(p_event_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_event public.match_events; v_green public.match_events;
begin
 select * into v_event from public.match_events where id=p_event_id for update;
 if not private.is_official(v_event.match_id) or v_event.reversed_at is not null then raise exception 'Assigned official and active event required'; end if;
 if exists(select 1 from public.disciplinary_redemptions where green_event_id=p_event_id or red_event_id=p_event_id)
 then raise exception 'An authorized card redemption must be reviewed before reversing this event'; end if;
 if v_event.event_type='goal' and
  (select count(*) from public.match_events where match_id=v_event.match_id and player_id=v_event.player_id and event_type='goal' and reversed_at is null)=3 and
  exists(select 1 from public.match_events g join public.disciplinary_transactions d on d.match_event_id=g.id and d.reason='Hat-trick' and d.action='issued'
   join public.disciplinary_redemptions r on r.green_event_id=g.id where g.match_id=v_event.match_id and g.player_id=v_event.player_id and g.reversed_at is null)
 then raise exception 'Review the existing green card redemption before reversing this goal'; end if;
 update public.match_events set reversed_at=now(),reversed_by=auth.uid() where id=p_event_id;
 if v_event.event_type<>'goal' then insert into public.disciplinary_transactions(group_id,match_event_id,user_id,card_type,action,created_by)
 values(v_event.group_id,p_event_id,v_event.player_id,v_event.event_type,'reversed',auth.uid()); end if;
 if v_event.event_type='goal' and (select count(*) from public.match_events where match_id=v_event.match_id and player_id=v_event.player_id and event_type='goal' and reversed_at is null)<3 then
  select e.* into v_green from public.match_events e join public.disciplinary_transactions d on d.match_event_id=e.id and d.action='issued' and d.reason='Hat-trick'
  where e.match_id=v_event.match_id and e.player_id=v_event.player_id and e.event_type='green' and e.reversed_at is null limit 1 for update of e;
  if v_green.id is not null then
   update public.match_events set reversed_at=now(),reversed_by=auth.uid() where id=v_green.id;
   insert into public.disciplinary_transactions(group_id,match_event_id,user_id,card_type,action,created_by,reason)
   values(v_green.group_id,v_green.id,v_green.player_id,'green','reversed',auth.uid(),'Hat-trick goal reversed');
  end if;
 end if;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id) values(v_event.group_id,auth.uid(),'match_event_reversed','match_event',p_event_id);
end $$;
create function public.submit_rating(p_match_id uuid,p_ratee_id uuid,p_performance integer,p_teamwork integer,p_effort integer) returns void language plpgsql security definer set search_path='' as $$
declare v_match public.matches; v_user uuid:=auth.uid(); v_window integer; v_team uuid;
begin
 if v_user is null or v_user=p_ratee_id then raise exception 'Self rating is not allowed'; end if;
 if p_performance not between 1 and 10 or p_teamwork not between 1 and 10 or p_effort not between 1 and 10 then raise exception 'Ratings must be 1 to 10'; end if;
 select * into v_match from public.matches where id=p_match_id;
 select rating_window_hours into v_window from public.groups where id=v_match.group_id;
 if v_match.status<>'completed' or now()>v_match.ended_at+make_interval(hours=>v_window) then raise exception 'Rating window is closed'; end if;
 select team_id into v_team from public.team_players where session_id=v_match.session_id and user_id=v_user and team_id in (v_match.home_team_id,v_match.away_team_id);
 if v_team is null or not exists(select 1 from public.team_players where session_id=v_match.session_id and team_id=v_team and user_id=p_ratee_id) then raise exception 'Only participating teammates can rate'; end if;
 insert into public.player_ratings(group_id,match_id,ratee_id,rater_id,performance,teamwork,effort)
 values(v_match.group_id,p_match_id,p_ratee_id,v_user,p_performance,p_teamwork,p_effort);
 insert into public.player_rating_summaries(group_id,user_id,overall_ovr,rating_count)
 select v_match.group_id,p_ratee_id,round(avg((performance+teamwork+effort)/3.0)*10)::integer,count(*)::integer
 from public.player_ratings where group_id=v_match.group_id and ratee_id=p_ratee_id
 on conflict(group_id,user_id) do update set overall_ovr=excluded.overall_ovr,rating_count=excluded.rating_count,updated_at=now();
end $$;

revoke all on all functions in schema public from public,anon;
grant execute on function public.create_group(text),public.add_member_by_email(uuid,text),public.create_weekly_sessions(uuid,timestamptz,timestamptz,text),public.set_maqraa_status(uuid,public.maqraa_state),public.rotate_maqraa_token(uuid),public.check_in_maqraa(text),public.set_booking(uuid,public.booking_state),public.admin_set_booking(uuid,uuid,public.booking_state),public.lock_roster(uuid),public.save_teams(uuid,jsonb),public.publish_teams(uuid),public.schedule_matches(uuid),public.assign_match_official(uuid,uuid,text),public.set_match_state(uuid,public.match_state),public.record_match_event(uuid,uuid,uuid,public.match_event_type,uuid),public.reverse_match_event(uuid),public.submit_rating(uuid,uuid,integer,integer,integer) to authenticated;

create function public.admin_set_initial_ovr(p_group_id uuid,p_user_id uuid,p_ovr integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin(p_group_id) then raise exception 'Admin permission required'; end if;
 if p_ovr is null or p_ovr not between 0 and 100 then raise exception 'OVR must be 0 to 100'; end if;
 if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=p_user_id and status='active') then raise exception 'Player not in group'; end if;
 update public.group_members set initial_ovr=p_ovr where group_id=p_group_id and user_id=p_user_id;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id,details) values(p_group_id,auth.uid(),'initial_ovr_set','profile',p_user_id,jsonb_build_object('ovr',p_ovr));
end $$;
create function public.admin_correct_maqraa(p_session_id uuid,p_user_id uuid,p_present boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_session public.maqraa_sessions;
begin
 select * into v_session from public.maqraa_sessions where id=p_session_id for update;
 if not private.is_admin(v_session.group_id) then raise exception 'Admin permission required'; end if;
 if not exists(select 1 from public.group_members where group_id=v_session.group_id and user_id=p_user_id and status='active') then raise exception 'Player not in group'; end if;
 if p_present then
  insert into public.maqraa_attendance(group_id,session_id,user_id,source,corrected_by) values(v_session.group_id,p_session_id,p_user_id,'manual',auth.uid()) on conflict(session_id,user_id) do update set source='manual',corrected_by=auth.uid();
  if v_session.football_session_id is not null then insert into public.football_attendance(group_id,session_id,user_id,status,updated_by) values(v_session.group_id,v_session.football_session_id,p_user_id,'pre_registered',auth.uid()) on conflict(session_id,user_id) do nothing; end if;
 else
  delete from public.maqraa_attendance where session_id=p_session_id and user_id=p_user_id;
  if v_session.football_session_id is not null then delete from public.football_attendance where session_id=v_session.football_session_id and user_id=p_user_id and status='pre_registered'; end if;
 end if;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id,details) values(v_session.group_id,auth.uid(),'maqraa_attendance_corrected','maqraa_session',p_session_id,jsonb_build_object('user_id',p_user_id,'present',p_present));
end $$;
revoke all on function public.admin_set_initial_ovr(uuid,uuid,integer),public.admin_correct_maqraa(uuid,uuid,boolean) from public,anon;
grant execute on function public.admin_set_initial_ovr(uuid,uuid,integer),public.admin_correct_maqraa(uuid,uuid,boolean) to authenticated;

create function public.update_group_settings(p_group_id uuid,p_timezone text,p_capacity integer,p_rating_window_hours integer,p_green_hat_trick_enabled boolean,p_green_redemption_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin(p_group_id) then raise exception 'Admin permission required'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
 if p_capacity not between 2 and 100 or p_rating_window_hours not between 1 and 168 then raise exception 'Invalid group settings'; end if;
 update public.groups set timezone=p_timezone,capacity=p_capacity,rating_window_hours=p_rating_window_hours,green_hat_trick_enabled=p_green_hat_trick_enabled,green_redemption_enabled=p_green_redemption_enabled where id=p_group_id;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id,details) values(p_group_id,auth.uid(),'group_settings_updated','group',p_group_id,jsonb_build_object('timezone',p_timezone,'capacity',p_capacity,'rating_window_hours',p_rating_window_hours,'green_hat_trick_enabled',p_green_hat_trick_enabled,'green_redemption_enabled',p_green_redemption_enabled));
end $$;
revoke all on function public.update_group_settings(uuid,text,integer,integer,boolean,boolean) from public,anon;
grant execute on function public.update_group_settings(uuid,text,integer,integer,boolean,boolean) to authenticated;

create function public.reopen_teams(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_group uuid;
begin
 select group_id into v_group from public.football_sessions where id=p_session_id for update;
 if not private.is_admin(v_group) then raise exception 'Admin permission required'; end if;
 if exists(select 1 from public.matches where session_id=p_session_id and status<>'scheduled') then raise exception 'A match has already started'; end if;
 delete from public.match_officials where match_id in (select id from public.matches where session_id=p_session_id);
 delete from public.matches where session_id=p_session_id;
 update public.teams set status='draft',updated_at=now() where session_id=p_session_id;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id) values(v_group,auth.uid(),'teams_reopened','football_session',p_session_id);
end $$;
revoke all on function public.reopen_teams(uuid) from public,anon;
grant execute on function public.reopen_teams(uuid) to authenticated;

create function public.redeem_green_for_red(p_green_event_id uuid,p_red_event_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_green public.match_events; v_red public.match_events;
begin
 select * into v_green from public.match_events where id=p_green_event_id for update;
 select * into v_red from public.match_events where id=p_red_event_id for update;
 if v_green.id is null or v_red.id is null or v_green.group_id<>v_red.group_id or v_green.player_id<>v_red.player_id then raise exception 'Cards must belong to the same player and group'; end if;
 if not private.is_admin(v_green.group_id) or not (select green_redemption_enabled from public.groups where id=v_green.group_id) then raise exception 'Authorized redemption is disabled'; end if;
 if v_green.event_type<>'green' or v_red.event_type<>'red' or v_green.reversed_at is not null or v_red.reversed_at is not null then raise exception 'Active green and red cards required'; end if;
 if length(trim(p_reason))<5 then raise exception 'A reason is required'; end if;
 insert into public.disciplinary_redemptions(group_id,green_event_id,red_event_id,authorized_by,reason)
 values(v_green.group_id,p_green_event_id,p_red_event_id,auth.uid(),left(trim(p_reason),500));
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id,details)
 values(v_green.group_id,auth.uid(),'green_card_redeemed','match_event',p_red_event_id,jsonb_build_object('green_event_id',p_green_event_id,'reason',left(trim(p_reason),500)));
end $$;
revoke all on function public.redeem_green_for_red(uuid,uuid,text) from public,anon;
grant execute on function public.redeem_green_for_red(uuid,uuid,text) to authenticated;

create function public.set_match_order(p_session_id uuid,p_order uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare v_group uuid; v_count integer; i integer;
begin
 select group_id into v_group from public.football_sessions where id=p_session_id for update;
 if not private.is_admin(v_group) then raise exception 'Admin permission required'; end if;
 if exists(select 1 from public.matches where session_id=p_session_id and status<>'scheduled') then raise exception 'Match order is locked after play starts'; end if;
 select count(*) into v_count from public.matches where session_id=p_session_id;
 if v_count=0 or coalesce(array_length(p_order,1),0)<>v_count or
  (select count(distinct match_id) from unnest(p_order) as x(match_id) where match_id in (select id from public.matches where session_id=p_session_id))<>v_count
 then raise exception 'Order must contain each session match exactly once'; end if;
 update public.matches set order_no=order_no+1000 where session_id=p_session_id;
 for i in 1..v_count loop update public.matches set order_no=i where id=p_order[i] and session_id=p_session_id; end loop;
 insert into public.audit_logs(group_id,actor_id,action,entity_type,entity_id) values(v_group,auth.uid(),'match_order_changed','football_session',p_session_id);
end $$;
revoke all on function public.set_match_order(uuid,uuid[]) from public,anon;
grant execute on function public.set_match_order(uuid,uuid[]) to authenticated;

do $$ begin
 if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.matches;
  alter publication supabase_realtime add table public.match_events;
  alter publication supabase_realtime add table public.football_attendance;
  alter publication supabase_realtime add table public.teams;
 end if;
end $$;
