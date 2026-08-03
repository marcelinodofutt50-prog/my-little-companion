
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apk_build_jobs TO authenticated;
GRANT ALL ON public.apk_build_jobs TO service_role;
GRANT SELECT ON public.apk_build_jobs TO anon;
