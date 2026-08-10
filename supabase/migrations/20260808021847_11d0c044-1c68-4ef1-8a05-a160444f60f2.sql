
-- Storage policies for the tutorials bucket
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access Tutorials'
    ) THEN
        CREATE POLICY "Public Access Tutorials"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'tutorials');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admin Upload Tutorials'
    ) THEN
        CREATE POLICY "Admin Upload Tutorials"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'tutorials' AND 
          (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admin Update Tutorials'
    ) THEN
        CREATE POLICY "Admin Update Tutorials"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (
          bucket_id = 'tutorials' AND 
          (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admin Delete Tutorials'
    ) THEN
        CREATE POLICY "Admin Delete Tutorials"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (
          bucket_id = 'tutorials' AND 
          (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
        );
    END IF;
END $$;

-- Ensure tutorials table permissions are solid
GRANT SELECT ON public.tutorials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;

-- Re-create the sync function with security definer to ensure it works
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify PostgREST to reload the schema cache
  NOTIFY pgrst, 'reload schema';
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO anon;
