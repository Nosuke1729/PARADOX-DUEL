create table public.duel_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'ended')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  check (host_id is distinct from guest_id)
);

create index duel_rooms_host_idx on public.duel_rooms(host_id);
create index duel_rooms_guest_idx on public.duel_rooms(guest_id);
create index duel_rooms_expiry_idx on public.duel_rooms(expires_at);

alter table public.duel_rooms enable row level security;
revoke all on public.duel_rooms from anon, authenticated;
grant select on public.duel_rooms to authenticated;

create policy "members can read their room" on public.duel_rooms
for select to authenticated
using ((select auth.uid()) in (host_id, guest_id));

create function public.create_duel_room(p_code text)
returns table(room_id uuid, room_code text, host_id uuid, guest_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.duel_rooms%rowtype;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  if p_code !~ '^[A-Z2-9]{6}$' then raise exception 'Invalid room code'; end if;
  insert into public.duel_rooms(code, host_id)
  values (p_code, v_uid)
  returning * into v_room;
  return query select v_room.id, v_room.code, v_room.host_id, v_room.guest_id;
end;
$$;

create function public.join_duel_room(p_code text)
returns table(room_id uuid, room_code text, host_id uuid, guest_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.duel_rooms%rowtype;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  if p_code !~ '^[A-Z2-9]{6}$' then raise exception 'Invalid room code'; end if;
  update public.duel_rooms r
  set guest_id = v_uid
  where r.code = p_code and r.guest_id is null and r.host_id <> v_uid
    and r.status = 'waiting' and r.expires_at > now()
  returning * into v_room;
  if not found then
    select * into v_room from public.duel_rooms r
    where r.code = p_code and r.guest_id = v_uid
      and r.status = 'waiting' and r.expires_at > now();
  end if;
  if v_room.id is null then raise exception 'Room not found or full'; end if;
  return query select v_room.id, v_room.code, v_room.host_id, v_room.guest_id;
end;
$$;

create function public.leave_duel_room(p_room_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  update public.duel_rooms r
  set status = case when r.host_id = v_uid then 'ended' else r.status end,
      guest_id = case when r.guest_id = v_uid then null else r.guest_id end
  where r.id = p_room_id and (r.host_id = v_uid or r.guest_id = v_uid);
end;
$$;

revoke all on function public.create_duel_room(text) from public, anon;
revoke all on function public.join_duel_room(text) from public, anon;
revoke all on function public.leave_duel_room(uuid) from public, anon;
grant execute on function public.create_duel_room(text) to authenticated;
grant execute on function public.join_duel_room(text) to authenticated;
grant execute on function public.leave_duel_room(uuid) to authenticated;

create policy "room members can receive realtime" on realtime.messages
for select to authenticated
using (
  extension in ('broadcast', 'presence') and exists (
    select 1 from public.duel_rooms r
    where 'duel:' || r.id::text = realtime.topic()
      and r.status = 'waiting' and r.expires_at > now()
      and (select auth.uid()) in (r.host_id, r.guest_id)
  )
);

create policy "room members can send realtime" on realtime.messages
for insert to authenticated
with check (
  extension in ('broadcast', 'presence') and exists (
    select 1 from public.duel_rooms r
    where 'duel:' || r.id::text = realtime.topic()
      and r.status = 'waiting' and r.expires_at > now()
      and (select auth.uid()) in (r.host_id, r.guest_id)
  )
);
