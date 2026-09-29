create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_lower_idx on public.profiles (lower(username));
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update (username, updated_at) on public.profiles to authenticated;
create policy "owners read profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owners create profile" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owners update profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.player_progress enable row level security;
revoke all on public.player_progress from anon, authenticated;
grant select on public.player_progress to authenticated;
create policy "owners read progress" on public.player_progress for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.save_player_progress(p_data jsonb, p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_revision bigint;
begin
  if v_uid is null or coalesce((select u.is_anonymous from auth.users u where u.id = v_uid), true) then
    raise exception 'Account login required';
  end if;
  if jsonb_typeof(p_data) <> 'object' or pg_catalog.length(p_data::text) > 100000 then
    raise exception 'Invalid progress payload';
  end if;
  if p_expected_revision = 0 then
    insert into public.player_progress(user_id, data)
    values (v_uid, p_data)
    on conflict (user_id) do nothing
    returning revision into v_revision;
  else
    update public.player_progress p set data = p_data, revision = p.revision + 1, updated_at = now()
    where p.user_id = v_uid and p.revision = p_expected_revision
    returning revision into v_revision;
  end if;
  if v_revision is null then raise exception 'Cloud revision conflict' using errcode = 'P0001'; end if;
  return v_revision;
end;
$$;
revoke all on function public.save_player_progress(jsonb,bigint) from public, anon;
grant execute on function public.save_player_progress(jsonb,bigint) to authenticated;
