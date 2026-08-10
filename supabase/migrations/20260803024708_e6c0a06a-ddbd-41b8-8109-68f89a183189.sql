GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_threads TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apk_build_jobs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trials TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apk_dropper_configs TO authenticated, service_role;

-- Ensure RLS is active and policies exist
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apk_build_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

-- Re-create/Fix Support Policies (Customer Access)
DROP POLICY IF EXISTS "Users can see their own threads" ON public.support_threads;
CREATE POLICY "Users can see their own threads" ON public.support_threads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own threads" ON public.support_threads;
CREATE POLICY "Users can create their own threads" ON public.support_threads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own threads" ON public.support_threads;
CREATE POLICY "Users can update their own threads" ON public.support_threads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can see messages in their threads" ON public.support_messages;
CREATE POLICY "Users can see messages in their threads" ON public.support_messages
  FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.support_threads WHERE id = thread_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can send messages to their threads" ON public.support_messages;
CREATE POLICY "Users can send messages to their threads" ON public.support_messages
  FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_threads WHERE id = thread_id AND user_id = auth.uid()));

-- APK Build Jobs Policies
DROP POLICY IF EXISTS "Users can see their own build jobs" ON public.apk_build_jobs;
CREATE POLICY "Users can see their own build jobs" ON public.apk_build_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create build jobs" ON public.apk_build_jobs;
CREATE POLICY "Users can create build jobs" ON public.apk_build_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Trials Policies
DROP POLICY IF EXISTS "Users can see their own trials" ON public.trials;
CREATE POLICY "Users can see their own trials" ON public.trials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Re-GRANT service_role to ensure bypass
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;