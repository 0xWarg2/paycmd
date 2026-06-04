alter table public.contacts add column if not exists contact_user_id uuid references auth.users(id) on delete set null;
alter table public.contacts add column if not exists preferred_chain text not null default 'arcTestnet';
alter table public.contacts add column if not exists label text;
alter table public.contacts add column if not exists status text not null default 'active';

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  default_chain text not null default 'arcTestnet',
  circle_wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  payer_user_id uuid references auth.users(id) on delete set null,
  payer_contact_id uuid references public.contacts(id) on delete set null,
  amount numeric(20, 6) not null,
  token text not null default 'USDC',
  destination_chain text not null default 'arcTestnet',
  recipient_address text not null,
  payer_label text,
  memo text,
  status text not null default 'pending',
  paid_tx_hash text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_requests_status_check check (status in ('pending', 'paid', 'cancelled', 'expired'))
);

create table if not exists public.payroll_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source_chain text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint payroll_batches_status_check check (status in ('draft', 'running', 'success', 'partial_failed', 'failed', 'cancelled'))
);

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payroll_batches(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  recipient_label text not null,
  recipient_address text not null,
  destination_chain text not null default 'arcTestnet',
  amount numeric(20, 6) not null,
  token text not null default 'USDC',
  status text not null default 'queued',
  tx_hash text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_items_status_check check (status in ('queued', 'running', 'success', 'failed'))
);

alter table public.user_profiles enable row level security;
alter table public.payment_requests enable row level security;
alter table public.payroll_batches enable row level security;
alter table public.payroll_items enable row level security;

drop policy if exists "profiles are owned by user" on public.user_profiles;
create policy "profiles are owned by user" on public.user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "payment requests visible to participants" on public.payment_requests;
create policy "payment requests visible to participants" on public.payment_requests
  for select using (status = 'pending' or auth.uid() = requester_user_id or auth.uid() = payer_user_id);

drop policy if exists "requesters create payment requests" on public.payment_requests;
create policy "requesters create payment requests" on public.payment_requests
  for insert with check (auth.uid() = requester_user_id);

drop policy if exists "participants update payment requests" on public.payment_requests;
create policy "participants update payment requests" on public.payment_requests
  for update using (status = 'pending' or auth.uid() = requester_user_id or auth.uid() = payer_user_id)
  with check (auth.uid() = requester_user_id or auth.uid() = payer_user_id);

drop policy if exists "payroll batches are owned by user" on public.payroll_batches;
create policy "payroll batches are owned by user" on public.payroll_batches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "payroll items visible through owned batch" on public.payroll_items;
create policy "payroll items visible through owned batch" on public.payroll_items
  for all using (
    exists (
      select 1 from public.payroll_batches
      where payroll_batches.id = payroll_items.batch_id
        and payroll_batches.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.payroll_batches
      where payroll_batches.id = payroll_items.batch_id
        and payroll_batches.user_id = auth.uid()
    )
  );

create index if not exists contacts_user_label_idx on public.contacts(user_id, lower(display_name));
create index if not exists payment_requests_requester_status_idx on public.payment_requests(requester_user_id, status);
create index if not exists payment_requests_payer_status_idx on public.payment_requests(payer_user_id, status);
create index if not exists payroll_batches_user_status_idx on public.payroll_batches(user_id, status);
create index if not exists payroll_items_batch_status_idx on public.payroll_items(batch_id, status);
