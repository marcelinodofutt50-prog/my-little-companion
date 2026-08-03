
-- Grants para apk_jobs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apk_jobs TO authenticated;
GRANT ALL ON public.apk_jobs TO service_role;
GRANT SELECT ON public.apk_jobs TO anon;

-- Grants para apk_dropper_configs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apk_dropper_configs TO authenticated;
GRANT ALL ON public.apk_dropper_configs TO service_role;
GRANT SELECT ON public.apk_dropper_configs TO anon;
