-- Correcting GRANTS for tutorial_progress and related tables to resolve PGRST108
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

GRANT SELECT ON public.tutorials TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;

COMMENT ON TABLE public.tutorial_progress IS 'Tracking user progress through shadow tutorials - Force Refresh v5.1';
COMMENT ON TABLE public.tutorials IS 'Shadow Training Hub modules - Force Refresh v5.1';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tutorial_progress' AND policyname = 'Users can manage their own progress'
    ) THEN
        CREATE POLICY "Users can manage their own progress" 
        ON public.tutorial_progress 
        FOR ALL 
        TO authenticated 
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
