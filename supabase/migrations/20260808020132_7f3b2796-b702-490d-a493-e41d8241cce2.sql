-- Emergency Data Infrastructure Repair
-- Ensuring tutorials table exists with correct permissions

-- 1. Create tutorials table if not exists
CREATE TABLE IF NOT EXISTS public.tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    image_url TEXT,
    youtube_url TEXT,
    category TEXT DEFAULT 'general',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Ensure RLS is enabled
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

-- 3. Grant permissions
GRANT SELECT ON public.tutorials TO anon;
GRANT SELECT ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;

-- 4. Create basic RLS policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access' AND tablename = 'tutorials') THEN
        CREATE POLICY "Public read access" ON public.tutorials FOR SELECT TO public USING (is_active = true);
    END IF;
END $$;

-- 5. Policies for tutorials bucket in storage.objects
DO $$
BEGIN
    -- Allow public read
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'tutorials');
    END IF;

    -- Allow authenticated uploads
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff Uploads' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Staff Uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tutorials');
    END IF;
END $$;

-- 6. Re-create the master repair function
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This function touches the relations to force PostgREST to notice them
    EXECUTE 'GRANT SELECT ON public.tutorials TO anon, authenticated';
    
    -- Notify PostgREST to reload schema
    NOTIFY pgrst, 'reload schema';
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO anon;
