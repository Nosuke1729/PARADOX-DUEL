create function public.get_ranked_match_names(p_match uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_ranked_account();
  m public.ranked_matches%rowtype;
  v_name1 text;
  v_name2 text;
begin
  select * into m from public.ranked_matches where id = p_match;
  if m.id is null or v_uid not in (m.player1,m.player2) then raise exception 'Match not found'; end if;
  select username into v_name1 from public.profiles where user_id = m.player1;
  select username into v_name2 from public.profiles where user_id = m.player2;
  return pg_catalog.jsonb_build_object('player1_name',v_name1,'player2_name',v_name2);
end;
$$;
revoke all on function public.get_ranked_match_names(uuid) from public, anon;
grant execute on function public.get_ranked_match_names(uuid) to authenticated;
