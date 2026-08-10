GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trials TO authenticated;
GRANT ALL ON public.trials TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.plans TO anon;
GRANT ALL ON public.plans TO service_role;

GRANT ALL ON public.integration_logs TO service_role;
GRANT SELECT ON public.integration_logs TO authenticated;

-- Refresh schema cache dummy update
ALTER TABLE public.support_messages ALTER COLUMN body SET DEFAULT NULL;
ALTER TABLE public.trials ALTER COLUMN ip_hash SET DEFAULT NULL;