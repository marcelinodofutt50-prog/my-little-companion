
create table if not exists public.crypto_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  plan_slug text not null,
  network text not null check (network in ('bitcoin','ethereum','tron','bsc')),
  coin text not null,
  tx_hash text not null,
  expected_address text not null,
  proof_path text,
  status text not null default 'pending' check (status in ('pending','verifying','confirmed','fulfilled','failed','rejected')),
  confirmations integer not null default 0,
  required_confirmations integer not null default 6,
  amount_brl numeric,
  last_checked_at timestamptz,
  verified_at timestamptz,
  fulfilled_at timestamptz,
  failure_reason text,
  admin_note text,
  created_at timestamptz not null default now()
);

create unique index if not exists crypto_payments_tx_unique
  on public.crypto_payments (network, lower(tx_hash));
create index if not exists crypto_payments_user_idx on public.crypto_payments (user_id, created_at desc);
create index if not exists crypto_payments_status_idx on public.crypto_payments (status) where status in ('pending','verifying');

grant select, insert on public.crypto_payments to authenticated;
grant all on public.crypto_payments to service_role;

alter table public.crypto_payments enable row level security;

create policy "crypto_payments read own or admin"
  on public.crypto_payments for select
  to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));

create policy "crypto_payments insert own"
  on public.crypto_payments for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "crypto_payments admin update"
  on public.crypto_payments for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

-- Storage policies (bucket 'crypto-proofs' already created via tool). Path: <user_id>/<uuid>.<ext>
create policy "crypto proofs upload own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'crypto-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "crypto proofs read own or admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'crypto-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'admin'::app_role))
  );

-- pg_cron: poll crypto payments every 2 minutes
do $$
declare
  base text;
  secret text;
begin
  begin
    select decrypted_secret into base from vault.decrypted_secrets where name = 'PUBLISHED_APP_ORIGIN' limit 1;
  exception when others then base := null; end;
  begin
    select decrypted_secret into secret from vault.decrypted_secrets where name = 'CRON_TRIGGER_TOKEN' limit 1;
  exception when others then secret := null; end;

  if base is null then base := 'https://shadowdashstore.lovable.app'; end if;
  if secret is null then return; end if;

  perform cron.unschedule('crypto-poll') where exists (select 1 from cron.job where jobname = 'crypto-poll');
  perform cron.schedule(
    'crypto-poll',
    '*/2 * * * *',
    format($f$select net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb) as request_id$f$,
      base || '/api/public/hooks/crypto-poll',
      json_build_object('Content-Type','application/json','x-cron-secret', secret)::text
    )
  );
end $$;
