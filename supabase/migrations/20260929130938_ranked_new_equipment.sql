-- Allow new earned equipment in Ranked while retaining cloud unlock checks.
create or replace function public.join_ranked_queue(p_loadout jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_ranked_account();
  s public.ranked_settings%rowtype;
  me public.ranked_queue%rowtype;
  opponent public.ranked_queue%rowtype;
  m public.ranked_matches%rowtype;
  v_room uuid;
  v_code text;
  v_width integer;
  v_attempt integer;
begin
  if jsonb_typeof(p_loadout) <> 'object' or pg_catalog.length(p_loadout::text) > 2000 or
    p_loadout->>'character' not in ('standard','light','heavy') or
    p_loadout->>'weapon' not in ('sword','spear','blaster','dagger','hammer') or
    p_loadout->>'skill' not in ('blink','shield','shockwave','echo_swap') then
    raise exception 'Invalid fighter';
  end if;
  perform pg_advisory_xact_lock(1729, 2026);
  select * into s from public.ranked_settings where singleton;
  delete from public.ranked_queue where heartbeat_at < now() - make_interval(secs => s.queue_timeout_seconds);
  update public.ranked_matches set status = 'cancelled', completed_at = now()
    where status = 'active' and greatest(heartbeat1, heartbeat2) <
      now() - make_interval(secs => s.disconnect_timeout_seconds * 4);
  delete from public.ranked_active_players a using public.ranked_matches r
    where a.match_id = r.id and r.status <> 'active';
  select r.* into m from public.ranked_matches r
    join public.ranked_active_players a on a.match_id = r.id
    where a.user_id = v_uid and r.status = 'active';
  if m.id is not null then return pg_catalog.jsonb_build_object('status','matched','match',to_jsonb(m)); end if;
  if not exists (select 1 from public.profiles where user_id = v_uid) then raise exception 'Username required'; end if;
  insert into public.ranked_stats(user_id) values (v_uid) on conflict do nothing;
  insert into public.ranked_queue(user_id,rating,loadout)
    select v_uid, rating, p_loadout from public.ranked_stats where user_id = v_uid
    on conflict(user_id) do update set heartbeat_at = now(), loadout = excluded.loadout;
  select * into me from public.ranked_queue where user_id = v_uid;
  v_width := case when extract(epoch from now() - me.joined_at) < s.expand_after_seconds
    then s.initial_range
    else s.expanded_range + floor((extract(epoch from now() - me.joined_at) - s.expand_after_seconds) /
      s.expand_step_seconds)::integer * s.expand_step_rating end;
  select q.* into opponent from public.ranked_queue q
    where q.user_id <> v_uid
      and abs(q.rating - me.rating) <= greatest(v_width,
        case when extract(epoch from now() - q.joined_at) < s.expand_after_seconds then s.initial_range
        else s.expanded_range + floor((extract(epoch from now() - q.joined_at) - s.expand_after_seconds) /
          s.expand_step_seconds)::integer * s.expand_step_rating end)
    order by q.joined_at limit 1;
  if opponent.user_id is null then return pg_catalog.jsonb_build_object('status','searching'); end if;
  for v_attempt in 1..5 loop
    select pg_catalog.string_agg(pg_catalog.substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
      pg_catalog.floor(pg_catalog.random() * 32)::integer + 1, 1), '')
      into v_code from pg_catalog.generate_series(1,6);
    begin
      insert into public.duel_rooms(code,host_id,guest_id)
        values (v_code,opponent.user_id,v_uid) returning id into v_room;
      exit;
    exception when unique_violation then
      if v_attempt = 5 then raise; end if;
    end;
  end loop;
  insert into public.ranked_matches(room_id,player1,player2,loadout1,loadout2,rating1,rating2)
    values (v_room,opponent.user_id,v_uid,opponent.loadout,me.loadout,opponent.rating,me.rating)
    returning * into m;
  insert into public.ranked_active_players(user_id,match_id)
    values (opponent.user_id,m.id),(v_uid,m.id);
  delete from public.ranked_queue where user_id in (opponent.user_id,v_uid);
  return pg_catalog.jsonb_build_object('status','matched','match',to_jsonb(m));
end;
$$;

create or replace function private.validate_ranked_loadout()
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
    or (fighter->>'weapon' = 'spear' and fighter->>'attack' not in ('spear_thrust','spear_sweep'))
    or (fighter->>'weapon' = 'blaster' and fighter->>'attack' not in ('blaster_shot','charged_shot'))
    or (fighter->>'weapon' = 'dagger' and fighter->>'attack' not in ('dagger_stab','dagger_lunge'))
    or (fighter->>'weapon' = 'hammer' and fighter->>'attack' not in ('hammer_smash','hammer_upper')) then
    raise exception 'Attack does not match weapon';
  end if;
  return new;
end;
$$;
