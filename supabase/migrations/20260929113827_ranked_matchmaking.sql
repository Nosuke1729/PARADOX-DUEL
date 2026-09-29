create table public.ranked_settings (
  singleton boolean primary key default true check (singleton),
  initial_rating integer not null default 1000,
  elo_k integer not null default 32,
  initial_range integer not null default 150,
  expanded_range integer not null default 300,
  expand_after_seconds integer not null default 10,
  expand_step_seconds integer not null default 10,
  expand_step_rating integer not null default 150,
  queue_timeout_seconds integer not null default 30,
  disconnect_timeout_seconds integer not null default 25,
  ranking_limit integer not null default 100
);
insert into public.ranked_settings(singleton) values (true);
alter table public.ranked_settings enable row level security;
revoke all on public.ranked_settings from anon, authenticated;

create table public.ranked_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating integer not null default 1000 check (rating >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  matches integer not null default 0 check (matches >= 0),
  highest_rating integer not null default 1000 check (highest_rating >= 0),
  season_id text not null default 'S1',
  updated_at timestamptz not null default now()
);
alter table public.ranked_stats enable row level security;
revoke all on public.ranked_stats from anon, authenticated;
grant select on public.ranked_stats to authenticated;
create policy "owners read ranked stats" on public.ranked_stats for select to authenticated
  using ((select auth.uid()) = user_id);
create index ranked_stats_rating_idx on public.ranked_stats(rating desc, wins desc);

create table public.ranked_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating integer not null,
  loadout jsonb not null,
  joined_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);
create index ranked_queue_waiting_idx on public.ranked_queue(joined_at);
alter table public.ranked_queue enable row level security;
revoke all on public.ranked_queue from anon, authenticated;

create table public.ranked_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.duel_rooms(id),
  player1 uuid not null references auth.users(id),
  player2 uuid not null references auth.users(id),
  loadout1 jsonb not null,
  loadout2 jsonb not null,
  rating1 integer not null,
  rating2 integer not null,
  rating_after1 integer,
  rating_after2 integer,
  result_claim1 text check (result_claim1 in ('p1','p2','draw')),
  result_claim2 text check (result_claim2 in ('p1','p2','draw')),
  winner uuid references auth.users(id),
  status text not null default 'active' check (status in ('active','completed','cancelled','disputed')),
  heartbeat1 timestamptz not null default now(),
  heartbeat2 timestamptz not null default now(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (player1 <> player2)
);
create index ranked_matches_player1_idx on public.ranked_matches(player1, started_at desc);
create index ranked_matches_player2_idx on public.ranked_matches(player2, started_at desc);
alter table public.ranked_matches enable row level security;
revoke all on public.ranked_matches from anon, authenticated;
grant select on public.ranked_matches to authenticated;
create policy "participants read ranked match" on public.ranked_matches for select to authenticated
  using ((select auth.uid()) in (player1, player2));

create table public.ranked_active_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  match_id uuid not null references public.ranked_matches(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ranked_active_match_idx on public.ranked_active_players(match_id);
alter table public.ranked_active_players enable row level security;
revoke all on public.ranked_active_players from anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.require_ranked_account()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or coalesce((select u.is_anonymous from auth.users u where u.id = v_uid), true) then
    raise exception 'Account login required';
  end if;
  return v_uid;
end;
$$;
revoke all on function private.require_ranked_account() from public, anon, authenticated;

create function public.ensure_ranked_stats()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := private.require_ranked_account();
begin
  if not exists (select 1 from public.profiles where user_id = v_uid) then
    raise exception 'Username required';
  end if;
  insert into public.ranked_stats(user_id) values (v_uid) on conflict do nothing;
end;
$$;
revoke all on function public.ensure_ranked_stats() from public, anon;
grant execute on function public.ensure_ranked_stats() to authenticated;

create function private.finalize_ranked_match(p_match uuid, p_result text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  m public.ranked_matches%rowtype;
  s public.ranked_settings%rowtype;
  expected1 numeric;
  score1 numeric;
  delta1 integer;
  after1 integer;
  after2 integer;
  v_winner uuid;
begin
  select * into m from public.ranked_matches where id = p_match for update;
  if m.id is null or m.status <> 'active' then return; end if;
  if p_result not in ('p1','p2','draw') then raise exception 'Invalid result'; end if;
  select * into s from public.ranked_settings where singleton;
  score1 := case p_result when 'p1' then 1 when 'p2' then 0 else 0.5 end;
  expected1 := 1 / (1 + power(10::numeric, (m.rating2 - m.rating1)::numeric / 400));
  delta1 := round(s.elo_k * (score1 - expected1));
  after1 := greatest(0, m.rating1 + delta1);
  after2 := greatest(0, m.rating2 - delta1);
  v_winner := case p_result when 'p1' then m.player1 when 'p2' then m.player2 else null end;
  update public.ranked_stats set
    rating = after1, highest_rating = greatest(highest_rating, after1),
    wins = wins + case when p_result = 'p1' then 1 else 0 end,
    losses = losses + case when p_result = 'p2' then 1 else 0 end,
    matches = matches + 1, updated_at = now()
    where user_id = m.player1;
  update public.ranked_stats set
    rating = after2, highest_rating = greatest(highest_rating, after2),
    wins = wins + case when p_result = 'p2' then 1 else 0 end,
    losses = losses + case when p_result = 'p1' then 1 else 0 end,
    matches = matches + 1, updated_at = now()
    where user_id = m.player2;
  update public.ranked_matches set status = 'completed', winner = v_winner,
    rating_after1 = after1, rating_after2 = after2, completed_at = now()
    where id = m.id;
  delete from public.ranked_active_players where match_id = m.id;
end;
$$;
revoke all on function private.finalize_ranked_match(uuid,text) from public, anon, authenticated;

create function public.join_ranked_queue(p_loadout jsonb)
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
    p_loadout->>'weapon' not in ('sword','spear','blaster') or
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
revoke all on function public.join_ranked_queue(jsonb) from public, anon;
grant execute on function public.join_ranked_queue(jsonb) to authenticated;

create function public.cancel_ranked_queue()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := private.require_ranked_account();
begin
  delete from public.ranked_queue where user_id = v_uid;
end;
$$;
revoke all on function public.cancel_ranked_queue() from public, anon;
grant execute on function public.cancel_ranked_queue() to authenticated;

create function public.ranked_heartbeat(p_match uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := private.require_ranked_account();
begin
  update public.ranked_matches set
    heartbeat1 = case when player1 = v_uid then now() else heartbeat1 end,
    heartbeat2 = case when player2 = v_uid then now() else heartbeat2 end
    where id = p_match and status = 'active' and v_uid in (player1,player2);
end;
$$;
revoke all on function public.ranked_heartbeat(uuid) from public, anon;
grant execute on function public.ranked_heartbeat(uuid) to authenticated;

create function public.submit_ranked_result(p_match uuid, p_result text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_ranked_account();
  m public.ranked_matches%rowtype;
begin
  select * into m from public.ranked_matches where id = p_match for update;
  if m.id is null or v_uid not in (m.player1,m.player2) then raise exception 'Match not found'; end if;
  if m.status <> 'active' then return to_jsonb(m); end if;
  if p_result not in ('p1','p2','draw') then raise exception 'Invalid result'; end if;
  if v_uid = m.player1 then m.result_claim1 := p_result; else m.result_claim2 := p_result; end if;
  update public.ranked_matches set result_claim1 = m.result_claim1, result_claim2 = m.result_claim2 where id = m.id;
  if m.result_claim1 is not null and m.result_claim2 is not null then
    if m.result_claim1 = m.result_claim2 then
      perform private.finalize_ranked_match(m.id,m.result_claim1);
    else
      update public.ranked_matches set status = 'disputed', completed_at = now() where id = m.id;
      delete from public.ranked_active_players where match_id = m.id;
    end if;
  end if;
  select * into m from public.ranked_matches where id = p_match;
  return to_jsonb(m);
end;
$$;
revoke all on function public.submit_ranked_result(uuid,text) from public, anon;
grant execute on function public.submit_ranked_result(uuid,text) to authenticated;

create function public.claim_ranked_disconnect(p_match uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_ranked_account();
  m public.ranked_matches%rowtype;
  s public.ranked_settings%rowtype;
  opponent_heartbeat timestamptz;
begin
  select * into m from public.ranked_matches where id = p_match for update;
  if m.id is null or v_uid not in (m.player1,m.player2) then raise exception 'Match not found'; end if;
  if m.status <> 'active' then return to_jsonb(m); end if;
  select * into s from public.ranked_settings where singleton;
  opponent_heartbeat := case when v_uid = m.player1 then m.heartbeat2 else m.heartbeat1 end;
  if opponent_heartbeat >= now() - make_interval(secs => s.disconnect_timeout_seconds) then
    raise exception 'Opponent may still reconnect';
  end if;
  perform private.finalize_ranked_match(m.id,case when v_uid = m.player1 then 'p1' else 'p2' end);
  select * into m from public.ranked_matches where id = p_match;
  return to_jsonb(m);
end;
$$;
revoke all on function public.claim_ranked_disconnect(uuid) from public, anon;
grant execute on function public.claim_ranked_disconnect(uuid) to authenticated;

create function public.get_rankings()
returns table(rank_position bigint, username text, rating integer, wins integer, is_self boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_ranked_account();
  v_limit integer;
begin
  select ranking_limit into v_limit from public.ranked_settings where singleton;
  return query
    with ordered as (
      select pg_catalog.row_number() over(order by s.rating desc,s.wins desc,s.user_id) as place,
        p.username, s.rating, s.wins, s.user_id
      from public.ranked_stats s join public.profiles p on p.user_id = s.user_id
    )
    select o.place, o.username, o.rating, o.wins, o.user_id = v_uid
      from ordered o where o.place <= v_limit or o.user_id = v_uid order by o.place;
end;
$$;
revoke all on function public.get_rankings() from public, anon;
grant execute on function public.get_rankings() to authenticated;
