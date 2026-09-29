-- Every completed username gets a visible initial 1000 rating, even before
-- the first search. The leaderboard RPC can then include YOUR RANK.
create function private.initialize_ranked_stats()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.ranked_stats(user_id) values (new.user_id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.initialize_ranked_stats() from public, anon, authenticated;
create trigger profile_initialize_ranked_stats after insert on public.profiles
  for each row execute function private.initialize_ranked_stats();
insert into public.ranked_stats(user_id)
  select user_id from public.profiles on conflict do nothing;
