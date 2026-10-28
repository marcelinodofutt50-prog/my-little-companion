-- Defensive containment only. Client job creation is intentionally disabled;
-- existing server handlers still use user-scoped inserts and must not be described as working.
REVOKE EXECUTE ON FUNCTION public.complete_loyalty_mission(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_loyalty_mission(uuid) TO service_role;
DROP POLICY IF EXISTS "users insert own apk jobs" ON public.apk_jobs;
DROP POLICY IF EXISTS "Users can create build jobs" ON public.apk_build_jobs;
DROP POLICY IF EXISTS "Users can insert their own build jobs" ON public.apk_build_jobs;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON public.apk_build_jobs;
REVOKE INSERT ON public.apk_jobs FROM anon, authenticated;
REVOKE INSERT ON public.apk_build_jobs FROM anon, authenticated;
