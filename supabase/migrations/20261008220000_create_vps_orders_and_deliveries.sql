-- VPS orders are populated only by a trusted payment-confirmation flow.
create table if not exists public.vps_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  order_reference text not null unique,
  plan_name text not null,
  cpu_brand text not null check (cpu_brand in ('intel', 'amd')),
  amount_cents bigint not null check (amount_cents >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vps_deliveries (
  id uuid primary key default gen_random_uuid(),
  vps_order_id uuid not null unique references public.vps_orders(id) on delete restrict,
  server_ip text not null,
  server_port integer not null check (server_port between 1 and 65535),
  username text not null,
  encrypted_password text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  admin_note text,
  delivered_by uuid not null references auth.users(id) on delete restrict,
  delivered_at timestamptz not null default now()
);

alter table public.vps_orders enable row level security;
alter table public.vps_deliveries enable row level security;

-- No direct client access. Read/write goes through authenticated server functions
-- after server-side role checks. Do not add broad authenticated policies here.
revoke all on public.vps_orders from anon, authenticated;
revoke all on public.vps_deliveries from anon, authenticated;
