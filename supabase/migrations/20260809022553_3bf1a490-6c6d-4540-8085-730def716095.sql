-- Grant access to all authenticated users for simple schema discovery
GRANT SELECT ON public.tutorial_progress TO authenticated;
GRANT SELECT ON public.tutorials TO authenticated;

-- Ensure the sync function is robust and has no return type issues
DROP FUNCTION IF EXISTS public.force_refresh_schema_permissions();

CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Force a schema reload notification to PostgREST
    PERFORM pg_notify('pgrst', 'reload schema');
    
    -- Perform dummy operations to wake up the cache for critical tables
    ANALYZE tutorials;
    ANALYZE tutorial_progress;
    ANALYZE user_roles;
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO service_role;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO anon;

-- Verification ping
SELECT 1 as "sync_init_complete";
