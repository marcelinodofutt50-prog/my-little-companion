-- Re-verify and force permissions for tutorial tables
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.tutorials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
GRANT ALL ON public.tutorial_progress TO service_role;
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';