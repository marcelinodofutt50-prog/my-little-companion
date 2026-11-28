-- ============================================================================
-- gangstar_access.sql
-- Flag de acesso ao painel da Gangstar, marcada pelo admin quando registra a
-- venda (Cakto). Só quem tem linha aqui vê a página /painel no site.
--
-- RODAR NOS DOIS BANCOS: Lovable Cloud E FILES (lsnkrdprzdijinstozhv).
-- ============================================================================

create table if not exists public.gangstar_access (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_by  uuid,
  granted_at  timestamptz not null default now(),
  note        text
);

alter table public.gangstar_access enable row level security;

-- Grants: service_role (servidor) administra; o cliente só lê a própria linha.
revoke all on public.gangstar_access from anon, authenticated;
grant all on public.gangstar_access to service_role;
grant select on public.gangstar_access to authenticated;

-- O cliente enxerga só o próprio acesso (a página /painel checa isso).
drop policy if exists gangstar_access_read_own on public.gangstar_access;
create policy gangstar_access_read_own on public.gangstar_access
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Staff/admin pode ver todos (para a ficha do cliente). Escrita é via service role.
drop policy if exists gangstar_access_staff_read on public.gangstar_access;
create policy gangstar_access_staff_read on public.gangstar_access
  for select to authenticated
  using (is_staff((select auth.uid())));

comment on table public.gangstar_access is 'Clientes liberados para o painel da Gangstar (/painel). Marcado pelo admin na venda.';
