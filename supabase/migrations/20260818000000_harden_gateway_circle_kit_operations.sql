alter table public.transaction_history
  add column if not exists gateway_request_fingerprint text;

create unique index if not exists wallets_one_sca_per_user_idx
  on public.wallets (user_id)
  where type = 'sca';

create table if not exists public.gateway_operation_recovery (
  transaction_id uuid primary key references public.transaction_history(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  gateway_operation_id uuid not null unique,
  recovery_payload jsonb not null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gateway_operation_recovery enable row level security;
revoke all on table public.gateway_operation_recovery from anon, authenticated;

create index if not exists gateway_operation_recovery_user_operation_idx
  on public.gateway_operation_recovery (user_id, gateway_operation_id);

create index if not exists gateway_operation_recovery_expiry_idx
  on public.gateway_operation_recovery (expires_at)
  where claimed_at is null;

alter table public.transaction_history
  drop constraint if exists transaction_history_gateway_state_check;

alter table public.transaction_history
  add constraint transaction_history_gateway_state_check
  check (
    gateway_state is null or gateway_state in (
      'pre_submit',
      'transfer_submitted',
      'pending_forwarding',
      'pending_mint',
      'forwarding_failed',
      'failed_before_submit',
      'reconciliation_required',
      'success'
    )
  );

create or replace function public.enforce_circle_kit_gateway_state_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.gateway_engine <> 'circle_kit' or new.gateway_operation_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.gateway_state <> 'pre_submit' then
      raise exception 'Circle Kit Gateway operations must start in pre_submit';
    end if;
    return new;
  end if;

  if new.gateway_state is not distinct from old.gateway_state then
    return new;
  end if;

  if not (
    (old.gateway_state = 'pre_submit' and new.gateway_state in (
      'transfer_submitted', 'pending_forwarding', 'pending_mint',
      'forwarding_failed', 'failed_before_submit', 'success'
    )) or
    (old.gateway_state = 'transfer_submitted' and new.gateway_state in (
      'pending_forwarding', 'pending_mint', 'forwarding_failed',
      'reconciliation_required', 'success'
    )) or
    (old.gateway_state = 'pending_forwarding' and new.gateway_state in (
      'pending_mint', 'forwarding_failed', 'reconciliation_required', 'success'
    )) or
    (old.gateway_state = 'pending_mint' and new.gateway_state in (
      'reconciliation_required', 'success'
    )) or
    (old.gateway_state = 'reconciliation_required' and new.gateway_state = 'success')
  ) then
    raise exception 'Invalid Circle Kit Gateway state transition: % -> %',
      old.gateway_state, new.gateway_state;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_circle_kit_gateway_state_transition
  on public.transaction_history;

create trigger enforce_circle_kit_gateway_state_transition
before insert or update of gateway_state on public.transaction_history
for each row execute function public.enforce_circle_kit_gateway_state_transition();

-- Forward-compatible cleanup for environments where the original untracked
-- migration was applied before recovery data moved into its private table.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transaction_history'
      and column_name = 'gateway_recovery'
  ) then
    execute $copy$
      insert into public.gateway_operation_recovery (
        transaction_id,
        user_id,
        gateway_operation_id,
        recovery_payload,
        expires_at
      )
      select
        id,
        user_id,
        gateway_operation_id,
        gateway_recovery,
        now() + interval '30 minutes'
      from public.transaction_history
      where gateway_recovery is not null
        and gateway_operation_id is not null
      on conflict (transaction_id) do nothing
    $copy$;

    execute 'alter table public.transaction_history drop column gateway_recovery';
  end if;
end $$;
