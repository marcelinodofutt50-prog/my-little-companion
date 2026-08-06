-- Force a PostgREST schema cache reload to resolve "Could not find table in schema cache"
NOTIFY pgrst, 'reload schema';

-- Ensure all tables exist and have correct grants (double-check for Vercel/Production consistency)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Specifically target the reported missing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

-- Simple permissive policy for progress (user-scoped)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tutorial_progress' AND policyname = 'Users can manage their own progress') THEN
        CREATE POLICY "Users can manage their own progress" 
        ON public.tutorial_progress 
        FOR ALL 
        TO authenticated 
        USING (auth.uid() = user_id);
    END IF;
END
$$;
