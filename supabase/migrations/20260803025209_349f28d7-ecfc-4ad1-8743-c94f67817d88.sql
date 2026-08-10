-- Fix schema cache issues and permissions for support and APK builder
GRANT ALL ON public.support_messages TO authenticated, service_role;
GRANT ALL ON public.support_threads TO authenticated, service_role;
GRANT ALL ON public.apk_build_jobs TO authenticated, service_role;
GRANT ALL ON public.apk_dropper_configs TO authenticated, service_role;
GRANT ALL ON public.trials TO authenticated, service_role;

-- Ensure RLS is enabled correctly
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apk_build_jobs ENABLE ROW LEVEL SECURITY;

-- Column safety check for reply_to_id
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_messages' AND column_name = 'reply_to_id') THEN
        ALTER TABLE public.support_messages ADD COLUMN reply_to_id uuid REFERENCES public.support_messages(id);
    END IF;
END $$;

-- Refresh cache by touching metadata
COMMENT ON TABLE public.support_messages IS 'Shadow Store Support Messages System';
COMMENT ON TABLE public.apk_build_jobs IS 'Shadow Store APK Build Jobs System';

-- Update policies to be robust
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.support_messages;
CREATE POLICY "Users can insert their own messages" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can view their own messages" ON public.support_messages;
CREATE POLICY "Users can view their own messages" ON public.support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.support_threads
      WHERE id = thread_id AND user_id = auth.uid()
    ) OR sender_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can insert their own build jobs" ON public.apk_build_jobs;
CREATE POLICY "Users can insert their own build jobs" ON public.apk_build_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own build jobs" ON public.apk_build_jobs;
CREATE POLICY "Users can view their own build jobs" ON public.apk_build_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
