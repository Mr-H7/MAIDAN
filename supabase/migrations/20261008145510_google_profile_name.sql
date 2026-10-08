-- Google sign-in stores the person's name under name as well as full_name.
-- Existing profiles are not rewritten.
create or replace function private.make_profile() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text;
begin
  v_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Player'
  ), 100);
  if length(v_name) < 2 then v_name := 'Player ' || left(new.id::text, 8); end if;
  insert into public.profiles(id, full_name) values (new.id, v_name);
  return new;
end $$;

revoke execute on function private.make_profile() from public, anon, authenticated;
