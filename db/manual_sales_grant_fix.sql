-- ============================================================================
-- FIX: "permission denied for table manual_sales" ao registrar venda externa.
-- ============================================================================
-- A tabela manual_sales foi criada mas o service_role (role usado pelas server
-- functions) ficou sem grant — só o 'postgres' (dono) tinha privilégio. O SQL
-- original só revogou de anon/authenticated e não concedeu ao service_role.
--
-- Rode isto nos bancos onde já criou a tabela (Lovable Cloud + FILES_SUPABASE).
-- Idempotente e seguro: concede só ao service_role; clientes seguem sem acesso.
-- ============================================================================

grant all on public.manual_sales to service_role;

-- Verificação (deve listar service_role com os privilégios):
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema='public' and table_name='manual_sales' order by grantee;
