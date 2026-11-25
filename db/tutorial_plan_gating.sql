-- ============================================================================
-- Centro de Treinamento: restrição de tutoriais por plano
-- ============================================================================
-- Adiciona a coluna allowed_plans em public.tutorials.
--   - NULL ou array vazio  => tutorial PÚBLICO (visível a todos) — comportamento atual.
--   - Array com plan_slug  => só usuários com LICENÇA ATIVA de um desses slugs
--                             conseguem ver (staff/admin vê tudo).
--
-- O filtro é aplicado no SERVIDOR (service role) em:
--   - src/lib/tutorial-loader.functions.ts  (viewer autenticado — getTutorials)
--   - src/lib/public-tutorials.functions.ts (páginas públicas — esconde restritos)
-- Nenhuma mudança de RLS é necessária: as leituras já passam pelo service role.
--
-- Aplicar em AMBOS os bancos (Lovable Cloud e FILES_SUPABASE / produção).
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================================

alter table public.tutorials
  add column if not exists allowed_plans text[];

comment on column public.tutorials.allowed_plans is
  'NULL/vazio = visível a todos. Caso contrário, só usuários com licença ativa de um desses plan_slug (staff vê tudo). Filtro aplicado no servidor (service role).';

-- Opcional: índice GIN para buscas futuras por plano (não exigido pelo filtro atual).
create index if not exists tutorials_allowed_plans_gin
  on public.tutorials using gin (allowed_plans);

-- Verificação rápida:
--   select id, title, category, allowed_plans from public.tutorials order by display_order;
