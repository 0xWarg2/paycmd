-- AI access is controlled entirely on the server. Authenticated clients can execute the
-- quota RPCs, but cannot read or modify either table directly.
create table if not exists public.ai_user_whitelist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_request_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint ai_request_reservations_status_check check (status in ('reserved', 'succeeded', 'refunded'))
);

create index if not exists ai_request_reservations_user_status_idx
  on public.ai_request_reservations(user_id, status, created_at desc);

alter table public.ai_user_whitelist enable row level security;
alter table public.ai_request_reservations enable row level security;

revoke all on public.ai_user_whitelist from anon, authenticated;
revoke all on public.ai_request_reservations from anon, authenticated;
grant all on public.ai_user_whitelist to service_role;
grant all on public.ai_request_reservations to service_role;

create or replace function public.reserve_deepseek_request()
returns table (reservation_id uuid, allowed boolean, unlimited boolean, used integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  requesting_user_id uuid := auth.uid();
  successful_requests integer;
  active_reservations integer;
  request_id uuid;
begin
  if requesting_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if exists (select 1 from public.ai_user_whitelist where user_id = requesting_user_id) then
    return query select null::uuid, true, true, null::integer, null::integer;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(requesting_user_id::text, 0));
  select count(*)::integer into successful_requests
  from public.ai_request_reservations
  where user_id = requesting_user_id and status = 'succeeded';
  select count(*)::integer into active_reservations
  from public.ai_request_reservations
  where user_id = requesting_user_id
    and status = 'reserved'
    and created_at > now() - interval '10 minutes';

  if successful_requests + active_reservations >= 10 then
    return query select null::uuid, false, false, successful_requests, greatest(0, 10 - successful_requests);
    return;
  end if;

  insert into public.ai_request_reservations(user_id) values (requesting_user_id) returning id into request_id;
  return query select request_id, true, false, successful_requests, 9 - successful_requests;
end;
$$;

create or replace function public.settle_deepseek_request(p_reservation_id uuid, p_succeeded boolean)
returns table (unlimited boolean, used integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  requesting_user_id uuid := auth.uid();
  successful_requests integer;
begin
  if requesting_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.ai_request_reservations
  set status = case when p_succeeded then 'succeeded' else 'refunded' end,
      settled_at = now()
  where id = p_reservation_id and user_id = requesting_user_id and status = 'reserved';

  select count(*)::integer into successful_requests
  from public.ai_request_reservations
  where user_id = requesting_user_id and status = 'succeeded';
  return query select false, successful_requests, greatest(0, 10 - successful_requests);
end;
$$;

revoke all on function public.reserve_deepseek_request() from public, anon;
revoke all on function public.settle_deepseek_request(uuid, boolean) from public, anon;
grant execute on function public.reserve_deepseek_request() to authenticated;
grant execute on function public.settle_deepseek_request(uuid, boolean) to authenticated;
