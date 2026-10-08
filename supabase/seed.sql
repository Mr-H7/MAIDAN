-- Local development only. Placeholder Auth rows have no password and cannot sign in.
-- Create a login-capable admin through local Studio or the app, then create a group.
insert into auth.users(id,email,raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000001','seed-admin@example.invalid','{"full_name":"Seed Admin"}'::jsonb);

insert into auth.users(id,email,raw_user_meta_data)
select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'seed-player-'||i||'@example.invalid',jsonb_build_object('full_name','Player '||i)
from generate_series(2,21) as i;

insert into public.groups(id,name,timezone,capacity,created_by)
values ('10000000-0000-4000-8000-000000000001','MAIDAN Local League','Africa/Cairo',20,'00000000-0000-4000-8000-000000000001');

insert into public.group_members(group_id,user_id)
select '10000000-0000-4000-8000-000000000001'::uuid,id from public.profiles
where id::text like '00000000-0000-4000-8000-%';
insert into public.group_roles(group_id,user_id,role,granted_by)
select '10000000-0000-4000-8000-000000000001'::uuid,id,
 case when id='00000000-0000-4000-8000-000000000001' then 'group_admin'::public.group_role else 'player'::public.group_role end,
 '00000000-0000-4000-8000-000000000001'::uuid
from public.profiles where id::text like '00000000-0000-4000-8000-%';
update public.group_members set initial_ovr=55+((right(user_id::text,2)::integer*3)%40)
where group_id='10000000-0000-4000-8000-000000000001';
update public.profiles set preferred_position=(array['Goalkeeper','Defender','Midfielder','Forward'])[1+(right(id::text,2)::integer%4)]
where id::text like '00000000-0000-4000-8000-%';

insert into public.football_sessions(id,group_id,starts_at,ends_at,venue,capacity,created_by)
select '30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 ((date_trunc('week',now() at time zone 'Africa/Cairo')+interval '1 week 4 days 21 hours') at time zone 'Africa/Cairo'),
 ((date_trunc('week',now() at time zone 'Africa/Cairo')+interval '1 week 4 days 23 hours') at time zone 'Africa/Cairo'),
 'Local training pitch',20,'00000000-0000-4000-8000-000000000001';
insert into public.maqraa_sessions(id,group_id,football_session_id,title,starts_at,created_by)
select '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001','Weekly Maqraa',
 ((date_trunc('week',now() at time zone 'Africa/Cairo')+interval '1 week 1 day 20 hours') at time zone 'Africa/Cairo'),
 '00000000-0000-4000-8000-000000000001';
insert into public.football_attendance(group_id,session_id,user_id,status,updated_by)
select '10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',id,'confirmed',
 '00000000-0000-4000-8000-000000000001' from public.profiles
where id::text like '00000000-0000-4000-8000-%' and id<>'00000000-0000-4000-8000-000000000001';
