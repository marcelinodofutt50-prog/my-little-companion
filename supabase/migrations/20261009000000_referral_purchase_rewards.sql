-- Persistent, server-only ledger for purchase-based referral rewards.
-- One order can grant each beneficiary role only once.
create table if not exists public.referral_purchase_rewards (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  beneficiary_role text not null check (beneficiary_role in ('referrer', 'buyer')),
  days integer not null check (days between 1 and 30),
  license_id uuid references public.licenses(id) on delete set null,
  previous_expires_at timestamptz,
  granted_expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'granted', 'skipped')),
  note text,
  created_at timestamptz not null default now(),
  granted_at timestamptz,
  unique (order_id, beneficiary_role)
);

create index if not exists referral_purchase_rewards_user_created_idx
  on public.referral_purchase_rewards(user_id, created_at desc);
create index if not exists referral_purchase_rewards_pending_idx
  on public.referral_purchase_rewards(status, created_at)
  where status = 'pending';

alter table public.referral_purchase_rewards enable row level security;
revoke all on public.referral_purchase_rewards from public, anon, authenticated;
grant all on public.referral_purchase_rewards to service_role;
