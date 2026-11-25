-- ============================================================================
-- Vendas externas registradas manualmente (Cakto / Gangstar / fora do site)
-- ============================================================================
-- Objetivo: o admin lança uma venda feita por fora e ela SOMA no "Gasto total"
-- do cliente (Customer 360), sem criar um pedido em public.orders — porque orders
-- tem triggers (ex.: abertura de suporte VPS) e provisionamento, e uma venda
-- externa não deve disparar entrega automática.
--
-- Acesso: somente service role (as server functions em src/lib/manual-sales.functions.ts
-- validam staff). RLS ligado e SEM policies => cliente/anon não lê nem escreve.
--
-- Aplicar em AMBOS os bancos (Lovable Cloud + FILES_SUPABASE / produção).
-- Idempotente.
-- ============================================================================

create table if not exists public.manual_sales (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     numeric(12,2) not null check (amount >= 0),
  label      text not null,                       -- plano/descrição (ex.: "Gangstar Mensal")
  source     text not null default 'externo',     -- cakto, gangstar, pix, externo...
  note       text,                                -- observação opcional
  created_by uuid,                                -- admin que registrou
  created_at timestamptz not null default now()
);

create index if not exists manual_sales_user_idx
  on public.manual_sales (user_id, created_at desc);

alter table public.manual_sales enable row level security;

-- Sem policies: apenas service role acessa. Garante que clientes não leiam/escrevam.
revoke all on public.manual_sales from anon, authenticated;

-- IMPORTANTE: as server functions usam a service_role key, que NÃO é dona da
-- tabela e precisa de grant explícito (o auto-grant do Supabase não cobriu esta
-- tabela — sem isto o insert dá "permission denied for table manual_sales").
grant all on public.manual_sales to service_role;

-- Verificação:
--   select user_id, amount, label, source, created_at from public.manual_sales order by created_at desc;
