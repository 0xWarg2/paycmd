create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  role text,
  wallet_address text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  token text not null default 'USDC',
  limit_amount numeric(20, 6) not null,
  used_amount numeric(20, 6) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint budgets_status_check check (status in ('active', 'paused', 'archived'))
);

create table if not exists public.payment_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  command_name text not null,
  raw_input text not null,
  parsed_fields jsonb not null default '{}'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  status text not null default 'draft_ready',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_drafts_status_check check (status in ('needs_input', 'draft_ready', 'confirmed', 'cancelled'))
);

create table if not exists public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  budget_id uuid references public.budgets(id) on delete set null,
  amount numeric(20, 6) not null,
  token text not null default 'USDC',
  frequency text not null,
  status text not null default 'active',
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_schedules_frequency_check check (frequency in ('daily', 'weekly', 'monthly', 'quarterly')),
  constraint payment_schedules_status_check check (status in ('active', 'paused', 'cancelled'))
);

create table if not exists public.command_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  payment_draft_id uuid references public.payment_drafts(id) on delete set null,
  payment_schedule_id uuid references public.payment_schedules(id) on delete set null,
  command_name text not null,
  status text not null default 'queued',
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint command_executions_status_check check (status in ('queued', 'running', 'waiting_gateway', 'success', 'failed'))
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  command_execution_id uuid references public.command_executions(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  status text not null default 'unread',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_status_check check (status in ('unread', 'read', 'archived'))
);

alter table public.contacts enable row level security;
alter table public.budgets enable row level security;
alter table public.payment_drafts enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.command_executions enable row level security;
alter table public.notifications enable row level security;

create policy "contacts are owned by user" on public.contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "budgets are owned by user" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "payment drafts are owned by user" on public.payment_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "payment schedules are owned by user" on public.payment_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "command executions are owned by user" on public.command_executions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notifications are owned by user" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists contacts_user_id_idx on public.contacts(user_id);
create index if not exists budgets_user_id_idx on public.budgets(user_id);
create index if not exists payment_drafts_user_id_idx on public.payment_drafts(user_id);
create index if not exists command_executions_user_id_status_idx on public.command_executions(user_id, status);
create index if not exists notifications_user_id_status_idx on public.notifications(user_id, status);
