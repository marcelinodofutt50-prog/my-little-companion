-- CREATE OR REPLACE FUNCTION force_refresh_schema_permissions
-- This function re-applies all grants and notifies PostgREST to reload its schema cache.

CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    t text;
    touch_comment text;
BEGIN
    -- 1. Notify PostgREST to reload schema
    PERFORM pg_notify('pgrst', 'reload schema');

    -- 2. Re-apply global grants
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
        EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END LOOP;

    -- 3. Specific public reads
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans' AND table_schema = 'public') THEN
        GRANT SELECT ON public.plans TO anon;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tutorials' AND table_schema = 'public') THEN
        GRANT SELECT ON public.tutorials TO anon;
    END IF;

    -- 4. Touch critical tables
    touch_comment := 'Refreshed at ' || now()::text;
    EXECUTE format('COMMENT ON TABLE public.profiles IS %L', touch_comment);
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tutorials' AND table_schema = 'public') THEN
        EXECUTE format('COMMENT ON TABLE public.tutorials IS %L', touch_comment);
    END IF;

    RETURN true;
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO service_role;
