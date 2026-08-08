-- REPARO DE PERMISSÕES E CACHE (GOLPE FINAL)
GRANT ALL ON TABLE public.tutorials TO service_role;
GRANT SELECT ON TABLE public.tutorials TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON TABLE public.tutorials TO authenticated;

GRANT ALL ON TABLE public.integration_logs TO service_role;
GRANT INSERT ON TABLE public.integration_logs TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    ANALYZE tutorials;
    ANALYZE integration_logs;
    EXECUTE 'GRANT SELECT ON public.tutorials TO anon, authenticated';
    NOTIFY pgrst, 'reload schema';
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO anon;
COMMENT ON TABLE public.tutorials IS 'Shadow Training Modules Schema Refreshed';