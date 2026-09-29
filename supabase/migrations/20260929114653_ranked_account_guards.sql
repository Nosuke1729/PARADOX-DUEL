-- Anonymous Auth sessions remain available for private rooms, but cannot own
-- account data or enter Ranked.
drop policy "owners read profile" on public.profiles;
drop policy "owners create profile" on public.profiles;
drop policy "owners update profile" on public.profiles;
drop policy "owners read progress" on public.player_progress;
drop policy "owners read ranked stats" on public.ranked_stats;
drop policy "participants read ranked match" on public.ranked_matches;

create policy "owners read profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) = false);
create policy "owners create profile" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) = false);
create policy "owners update profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) = false)
  with check ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) = false);
create policy "owners read progress" on public.player_progress for select to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) = false);
create policy "owners read ranked stats" on public.ranked_stats for select to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) = false);
create policy "participants read ranked match" on public.ranked_matches for select to authenticated
  using ((select auth.uid()) in (player1, player2) and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) = false);

-- Only RPCs can add queue rows. The trigger checks the cloud unlock snapshot,
-- so a modified browser cannot select a fighter it has not unlocked.
create function private.validate_ranked_loadout()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare p jsonb;
declare fighter jsonb := new.loadout;
begin
  select data into p from public.player_progress where user_id = new.user_id;
  if p is null then raise exception 'Cloud progress required for Ranked'; end if;
  if not coalesce((p->'unlockedCharacters') ? (fighter->>'character'), false)
    or not coalesce((p->'unlockedWeapons') ? (fighter->>'weapon'), false)
    or not coalesce((p->'unlockedSkills') ? (fighter->>'skill'), false)
    or not coalesce((p->'unlockedAttacks') ? (fighter->>'attack'), false) then
    raise exception 'Fighter is locked';
  end if;
  if (fighter->>'weapon' = 'sword' and fighter->>'attack' not in ('basic_slash','heavy_slash','upper_slash'))
    or (fighter->>'weapon' = 'spear' and fighter->>'attack' <> 'spear_thrust')
    or (fighter->>'weapon' = 'blaster' and fighter->>'attack' <> 'blaster_shot') then
    raise exception 'Attack does not match weapon';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_ranked_loadout() from public, anon, authenticated;
create trigger ranked_queue_validate_fighter before insert or update of loadout on public.ranked_queue
  for each row execute function private.validate_ranked_loadout();
