-- ============================================================================
-- Blindagem de segurança (saída da auditoria de grants/permissões)
-- ============================================================================
-- O linter do Supabase sinalizou funções de TRIGGER como executáveis via RPC
-- (/rest/v1/rpc/...) por anon/authenticated. Funções de trigger só devem rodar
-- como trigger (disparadas pelo dono da tabela), nunca ser chamadas direto por
-- um cliente. Revogar EXECUTE é seguro: o disparo do trigger NÃO depende desse
-- grant (o trigger executa com os privilégios do dono), só a chamada direta.
--
-- Aplicar em AMBOS os bancos (Lovable Cloud + FILES_SUPABASE / produção).
-- Idempotente.
-- ============================================================================

revoke execute on function public.customer_chat_before_write()            from public, anon, authenticated;
revoke execute on function public.enforce_support_thread_client_update()  from public, anon, authenticated;
revoke execute on function public.sanitize_client_insert()                from public, anon, authenticated;
revoke execute on function public.sync_admin_roles()                      from public, anon, authenticated;

-- Verificação: as 4 não devem mais aparecer no advisor de segurança
-- (0028/0029 security_definer_function_executable) para anon/authenticated.
