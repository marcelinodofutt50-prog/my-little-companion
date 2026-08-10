-- Re-grant permissions explicitly to ensure PostgREST and users can see the table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
GRANT SELECT ON public.tutorials TO anon;

-- Ensure RLS is correctly configured but permissive for authenticated users
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tutorials' AND policyname = 'Allow authenticated selects') THEN
        CREATE POLICY "Allow authenticated selects" ON public.tutorials FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tutorials' AND policyname = 'Allow admin all') THEN
        CREATE POLICY "Allow admin all" ON public.tutorials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- Force a schema cache refresh through a known working method
NOTIFY pgrst, 'reload schema';
SELECT pg_sleep(0.5);
ANALYZE public.tutorials;
