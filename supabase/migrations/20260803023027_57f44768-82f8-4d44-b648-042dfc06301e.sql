-- Grant permissions to essential tables to ensure PostgREST and RLS work correctly
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trials TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_threads TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apk_build_jobs TO authenticated, service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated, service_role;

-- Ensure service_role can do everything (required for createServerFn using supabaseAdmin)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';