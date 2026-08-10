-- Drop and recreate the refresh function to ensure type alignment
DROP FUNCTION IF EXISTS public.force_refresh_schema_permissions();

-- Redefine the force_refresh_schema_permissions function
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Force PostgREST to re-examine the schema cache by performing dummy work
    -- ANALYZE is good, but NOTIFY is the standard mechanism
    EXECUTE 'ANALYZE public.tutorials';
    EXECUTE 'ANALYZE public.tutorial_progress';
    EXECUTE 'ANALYZE public.user_roles';
    
    PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

-- Ensure grants are correct for API access
GRANT ALL ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;
GRANT ALL ON public.tutorial_progress TO anon;

GRANT ALL ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
GRANT ALL ON public.tutorials TO anon;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO service_role;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO anon;
