-- Serialize cancel with join. A match that nobody has started heartbeating yet
-- can be cancelled without a rating change.
create or replace function public.cancel_ranked_queue()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_ranked_account();
  m public.ranked_matches%rowtype;
begin
  perform pg_advisory_xact_lock(1729, 2026);
  delete from public.ranked_queue where user_id = v_uid;
  select r.* into m from public.ranked_matches r
    join public.ranked_active_players a on a.match_id = r.id
    where a.user_id = v_uid and r.status = 'active' for update of r;
  if m.id is not null and m.heartbeat1 = m.started_at and m.heartbeat2 = m.started_at then
    update public.ranked_matches set status = 'cancelled', completed_at = now() where id = m.id;
    delete from public.ranked_active_players where match_id = m.id;
  end if;
end;
$$;
