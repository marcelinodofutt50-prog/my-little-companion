CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Force PostgREST to notice the table by re-granting
    GRANT SELECT ON public.tutorials TO anon, authenticated;
    
    -- "Touch" the relation to update statistics/cache
    ANALYZE public.tutorials;
    
    -- Notify PostgREST to reload schema cache
    NOTIFY pgrst, 'reload schema';
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO anon;