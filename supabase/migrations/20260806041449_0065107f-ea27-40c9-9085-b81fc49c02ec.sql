-- Allow public read access to tutorials bucket objects
-- We use 'public' as the role for anon/authenticated access to public files
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        DROP POLICY IF EXISTS "Public Access" ON storage.objects;
        CREATE POLICY "Public Access" ON storage.objects 
        FOR SELECT 
        TO public 
        USING (bucket_id = 'tutorials');
        
        DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
        CREATE POLICY "Authenticated Upload" ON storage.objects 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (bucket_id = 'tutorials');

        DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
        CREATE POLICY "Authenticated Update" ON storage.objects 
        FOR UPDATE 
        TO authenticated 
        USING (bucket_id = 'tutorials');

        DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
        CREATE POLICY "Authenticated Delete" ON storage.objects 
        FOR DELETE 
        TO authenticated 
        USING (bucket_id = 'tutorials');
    END IF;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
