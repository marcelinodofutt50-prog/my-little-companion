-- 1. Permissões para tutoriais e progresso
GRANT SELECT ON public.tutorials TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
GRANT ALL ON public.tutorial_progress TO service_role;

-- 2. Permissões para cargos e perfis
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.profiles TO service_role;

-- 3. Permissões de execução para funções críticas
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated, anon;

-- 4. Toque tático nas tabelas para limpar cache do PostgREST
ANALYZE public.tutorials;
ANALYZE public.tutorial_progress;
ANALYZE public.user_roles;
ANALYZE public.profiles;

-- 5. Garantir que as tabelas de suporte também tenham permissões (estavam falhando em logs)
GRANT SELECT, INSERT, UPDATE ON public.support_threads TO authenticated;
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
GRANT ALL ON public.support_messages TO service_role;
