-- Final fix for column names and permissions to clear schema cache errors
ALTER TABLE public.trials ADD COLUMN IF NOT EXISTS ip_hash text;
ALTER TABLE public.trials ADD COLUMN IF NOT EXISTS user_agent text;

-- Ensure all tables used by the app have correct grants for the API
GRANT ALL ON public.trials TO authenticated, service_role;
GRANT ALL ON public.apk_build_jobs TO authenticated, service_role;
GRANT ALL ON public.support_threads TO authenticated, service_role;
GRANT ALL ON public.support_messages TO authenticated, service_role;
GRANT ALL ON public.profiles TO authenticated, service_role;
GRANT ALL ON public.licenses TO authenticated, service_role;
GRANT ALL ON public.orders TO authenticated, service_role;
GRANT ALL ON public.apk_dropper_configs TO authenticated, service_role;

-- Force a reload of the PostgREST schema cache
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
