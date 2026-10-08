-- The profile trigger is invoked by auth.users, not by client RPC callers.
revoke execute on function private.make_profile() from public, anon, authenticated;

-- A NULL correction choice previously entered the removal branch. Reject it explicitly.
create or replace function public.admin_correct_maqraa(
  p_session_id uuid,
  p_user_id uuid,
  p_present boolean
) returns void language plpgsql security definer set search_path='' as $$
declare v_session public.maqraa_sessions;
begin
 if p_present is null then raise exception 'Attendance choice is required'; end if;
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
