create extension if not exists pgcrypto with schema extensions;

create table if not exists public.contact_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_groups_name_not_blank check (length(btrim(name)) > 0),
  constraint contact_groups_name_max check (char_length(name) <= 80),
  constraint contact_groups_user_normalized_name_key unique (user_id, normalized_name)
);

create table if not exists public.contact_group_members (
  group_id uuid not null references public.contact_groups(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, contact_id)
);

create index if not exists contact_groups_user_created_idx
  on public.contact_groups(user_id, created_at, id);
create index if not exists contact_group_members_group_created_idx
  on public.contact_group_members(group_id, created_at, contact_id);
create index if not exists contact_group_members_contact_idx
  on public.contact_group_members(contact_id);

alter table public.contact_groups enable row level security;
alter table public.contact_group_members enable row level security;

drop policy if exists "contact groups are owned by user" on public.contact_groups;
create policy "contact groups are owned by user" on public.contact_groups
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "contact group members visible through owned group" on public.contact_group_members;
create policy "contact group members visible through owned group" on public.contact_group_members
  for select
  using (
    exists (
      select 1 from public.contact_groups g
      where g.id = group_id and g.user_id = auth.uid()
    )
  );

drop policy if exists "owned group members can be added" on public.contact_group_members;
create policy "owned group members can be added" on public.contact_group_members
  for insert
  with check (
    exists (select 1 from public.contact_groups g where g.id = group_id and g.user_id = auth.uid())
    and exists (select 1 from public.contacts c where c.id = contact_id and c.user_id = auth.uid())
  );

drop policy if exists "owned group members can be removed" on public.contact_group_members;
create policy "owned group members can be removed" on public.contact_group_members
  for delete
  using (
    exists (
      select 1 from public.contact_groups g
      where g.id = group_id and g.user_id = auth.uid()
    )
  );

alter table public.payroll_batches
  add column if not exists contact_group_id uuid references public.contact_groups(id) on delete set null,
  add column if not exists recipient_count integer,
  add column if not exists per_recipient_amount numeric(20, 6),
  add column if not exists total_amount numeric(20, 6),
  add column if not exists recipient_fingerprint text;

create index if not exists payroll_batches_user_group_created_idx
  on public.payroll_batches(user_id, contact_group_id, created_at desc);

create or replace function public.payroll_group_recipients(p_group_id uuid)
returns table (
  contact_id uuid,
  recipient_label text,
  recipient_address text,
  destination_chain text,
  membership_created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    c.id,
    coalesce(nullif(c.label, ''), c.display_name),
    c.wallet_address,
    c.preferred_chain,
    membership.created_at
  from public.contact_group_members membership
  join public.contact_groups group_row on group_row.id = membership.group_id
  join public.contacts c on c.id = membership.contact_id
  where membership.group_id = p_group_id
    and group_row.user_id = auth.uid()
    and c.user_id = auth.uid()
    and c.status = 'active'
    and c.wallet_address ~* '^0x[0-9a-f]{40}$'
  order by membership.created_at asc, c.id asc
  limit 25
$$;

create or replace function public.payroll_recipient_fingerprint(p_group_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select encode(
    extensions.digest(
      coalesce(
        string_agg(
          concat(
            char_length(recipient.contact_id::text), ':', recipient.contact_id::text,
            char_length(lower(recipient.recipient_address)), ':', lower(recipient.recipient_address),
            char_length(recipient.destination_chain), ':', recipient.destination_chain,
            char_length('active'), ':active'
          ),
          E'\\x1f' order by recipient.membership_created_at, recipient.contact_id
        ),
        ''
      ),
      'sha256'
    ),
    'hex'
  )
  from public.payroll_group_recipients(p_group_id) recipient
$$;

create or replace function public.create_payroll_batch_snapshot(
  p_group_id uuid,
  p_amount numeric,
  p_source_chain text,
  p_expected_fingerprint text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_fingerprint text;
  group_name text;
  recipient_total integer;
  batch_id uuid;
begin
  if current_user_id is null then
    raise exception 'PAYROLL_UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select name into group_name
  from public.contact_groups
  where id = p_group_id and user_id = current_user_id;

  if group_name is null then
    raise exception 'PAYROLL_GROUP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'PAYROLL_AMOUNT_INVALID' using errcode = 'P0001';
  end if;

  current_fingerprint := public.payroll_recipient_fingerprint(p_group_id);
  if current_fingerprint is distinct from p_expected_fingerprint then
    raise exception 'PAYROLL_PREVIEW_STALE' using errcode = 'P0001';
  end if;

  select count(*) into recipient_total
  from public.payroll_group_recipients(p_group_id);

  if recipient_total = 0 then
    raise exception 'PAYROLL_GROUP_EMPTY' using errcode = 'P0001';
  end if;

  insert into public.payroll_batches (
    user_id,
    name,
    source_chain,
    status,
    contact_group_id,
    recipient_count,
    per_recipient_amount,
    total_amount,
    recipient_fingerprint
  ) values (
    current_user_id,
    format('Payroll — %s', group_name),
    p_source_chain,
    'draft',
    p_group_id,
    recipient_total,
    p_amount,
    p_amount * recipient_total,
    current_fingerprint
  ) returning id into batch_id;

  insert into public.payroll_items (
    batch_id,
    contact_id,
    recipient_label,
    recipient_address,
    destination_chain,
    amount,
    token,
    status
  )
  select
    batch_id,
    recipient.contact_id,
    recipient.recipient_label,
    recipient.recipient_address,
    recipient.destination_chain,
    p_amount,
    'USDC',
    'queued'
  from public.payroll_group_recipients(p_group_id) recipient;

  return batch_id;
end;
$$;
