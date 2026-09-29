-- A disconnected participant cannot return later and claim the other player's
-- timeout. Only a participant with a recent server heartbeat may claim.
create or replace function public.claim_ranked_disconnect(p_match uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_ranked_account();
  m public.ranked_matches%rowtype;
  s public.ranked_settings%rowtype;
  my_heartbeat timestamptz;
  opponent_heartbeat timestamptz;
begin
  select * into m from public.ranked_matches where id = p_match for update;
  if m.id is null or v_uid not in (m.player1,m.player2) then raise exception 'Match not found'; end if;
  if m.status <> 'active' then return to_jsonb(m); end if;
  select * into s from public.ranked_settings where singleton;
  my_heartbeat := case when v_uid = m.player1 then m.heartbeat1 else m.heartbeat2 end;
  opponent_heartbeat := case when v_uid = m.player1 then m.heartbeat2 else m.heartbeat1 end;
  if my_heartbeat < now() - make_interval(secs => s.disconnect_timeout_seconds / 2) then
    raise exception 'Own connection expired';
  end if;
  if opponent_heartbeat >= now() - make_interval(secs => s.disconnect_timeout_seconds) then
    raise exception 'Opponent may still reconnect';
  end if;
  perform private.finalize_ranked_match(m.id,case when v_uid = m.player1 then 'p1' else 'p2' end);
  select * into m from public.ranked_matches where id = p_match;
  return to_jsonb(m);
end;
$$;
