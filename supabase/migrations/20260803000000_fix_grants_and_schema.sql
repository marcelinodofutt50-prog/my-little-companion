-- Ensure all tables have proper GRANTS for authenticated and service_role
-- This prevents PGRST204 and permission errors when new columns are added.

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
        EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
        -- For tables that need anon access (like public plans or site settings), add them here:
        -- GRANT SELECT ON public.plans TO anon;
    END LOOP;
END $$;

GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.announcements TO anon;
GRANT SELECT ON public.site_settings TO anon;

-- Refresh schema cache trigger (dummy change to a widely used table to poke PostgREST)
COMMENT ON TABLE public.support_messages IS 'Shadow Support Messages with Reply Threading Support';
COMMENT ON TABLE public.trials IS 'Shadow Trial Redemption Tracking with Anti-Fraud';
