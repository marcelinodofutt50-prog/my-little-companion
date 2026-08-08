-- Reforçar a função de reparo tático com maior abrangência
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Re-garantir permissões em todas as tabelas críticas
    EXECUTE 'GRANT SELECT ON public.tutorials TO anon, authenticated, service_role';
    EXECUTE 'GRANT SELECT ON public.tutorial_progress TO authenticated, service_role';
    EXECUTE 'GRANT SELECT ON public.user_roles TO authenticated, service_role';
    EXECUTE 'GRANT SELECT ON public.profiles TO authenticated, service_role';
    EXECUTE 'GRANT SELECT ON public.orders TO authenticated, service_role';
    EXECUTE 'GRANT SELECT ON public.licenses TO authenticated, service_role';
    EXECUTE 'GRANT SELECT ON public.integration_logs TO authenticated, service_role';
    
    -- "Tocar" as relações para forçar o cache do PostgREST
    ANALYZE public.tutorials;
    ANALYZE public.tutorial_progress;
    ANALYZE public.user_roles;
    ANALYZE public.profiles;
    
    -- Notificar o reload do schema
    PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO service_role;
