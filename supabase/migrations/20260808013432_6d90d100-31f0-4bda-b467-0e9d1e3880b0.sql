-- 0. Drop the existing function to allow return type change
DROP FUNCTION IF EXISTS public.force_refresh_schema_permissions();

-- 1. Garante permissões básicas para PostgREST operar no schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 2. Recria a função de reload com SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.notify_pgrst_reload()
RETURNS void AS $$
  NOTIFY pgrst, 'reload schema';
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.notify_pgrst_reload() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_pgrst_reload() TO service_role;

-- 3. Função robusta de auto-reparo que garante GRANTS e dispara reload
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS jsonb AS $$
BEGIN
    -- Re-aplica SELECT em tudo para autenticados
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
    
    -- Privilégios específicos para progresso de tutorial
    GRANT INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
    
    -- Notifica o reload
    PERFORM public.notify_pgrst_reload();
    
    RETURN jsonb_build_object(
        'status', 'success',
        'timestamp', now(),
        'action', 'grants_reapplied_and_reloaded'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO service_role;

-- 4. Garante RLS ativo
ALTER TABLE IF EXISTS public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tutorial_progress ENABLE ROW LEVEL SECURITY;
