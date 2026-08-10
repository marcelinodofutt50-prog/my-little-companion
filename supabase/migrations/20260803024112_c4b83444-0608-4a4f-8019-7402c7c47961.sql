GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apk_build_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trials TO authenticated;

GRANT ALL ON public.support_threads TO service_role;
GRANT ALL ON public.support_messages TO service_role;
GRANT ALL ON public.apk_build_jobs TO service_role;
GRANT ALL ON public.trials TO service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

NOTIFY pgrst, 'reload schema';