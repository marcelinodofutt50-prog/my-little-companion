-- 1) Missões: a função não é usada pelo site e permitia pontos sem comprovar conclusão.
REVOKE EXECUTE ON FUNCTION public.complete_loyalty_mission(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_loyalty_mission(uuid) TO service_role;

-- 2) APK: criação de jobs somente pelo servidor (valida plano e teste grátis).
DROP POLICY IF EXISTS "users insert own apk jobs" ON public.apk_jobs;
DROP POLICY IF EXISTS "Users can create build jobs" ON public.apk_build_jobs;
DROP POLICY IF EXISTS "Users can insert their own build jobs" ON public.apk_build_jobs;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON public.apk_build_jobs;
REVOKE INSERT ON public.apk_jobs FROM anon, authenticated;
REVOKE INSERT ON public.apk_build_jobs FROM anon, authenticated;

-- 3) Comunidade e metas: só quem é cliente pagante ou equipe lê.
DROP POLICY IF EXISTS "community_messages_read_authenticated" ON public.community_messages;
CREATE POLICY "community_messages_read_members" ON public.community_messages
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_paying_customer(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "goals_read_authenticated" ON public.community_goals;
CREATE POLICY "goals_read_members" ON public.community_goals
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_paying_customer(auth.uid()));