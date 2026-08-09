GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;
GRANT SELECT ON public.tutorial_progress TO anon;

CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Força ANALYZE para invalidar estatísticas obsoletas e caches do PostgREST
    ANALYZE tutorials;
    ANALYZE tutorial_progress;
    ANALYZE user_roles;
    
    -- "Tocar" nas tabelas para forçar atualização do cache de metadados
    EXECUTE 'SELECT count(*) FROM tutorials';
    EXECUTE 'SELECT count(*) FROM tutorial_progress';
    
    NOTIFY pgrst, 'reload schema';
END;
$$;
