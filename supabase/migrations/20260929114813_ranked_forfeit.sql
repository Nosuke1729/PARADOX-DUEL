-- Voluntary exit before a result is submitted counts as a loss. The row lock
-- and finalize_ranked_match status check make retries safe.
create function public.forfeit_ranked_match(p_match uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_ranked_account();
  m public.ranked_matches%rowtype;
begin
  select * into m from public.ranked_matches where id = p_match for update;
  if m.id is null or v_uid not in (m.player1,m.player2) then raise exception 'Match not found'; end if;
  if m.status = 'active' then
    perform private.finalize_ranked_match(m.id, case when v_uid = m.player1 then 'p2' else 'p1' end);
  end if;
  select * into m from public.ranked_matches where id = p_match;
  return to_jsonb(m);
end;
$$;
revoke all on function public.forfeit_ranked_match(uuid) from public, anon;
grant execute on function public.forfeit_ranked_match(uuid) to authenticated;
