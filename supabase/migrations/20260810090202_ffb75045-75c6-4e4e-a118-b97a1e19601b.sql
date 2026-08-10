-- Shadow Protocol v15.1: Critical Schema Sync
-- Resolve PGRST205 for 'public.tutorial_progress' and enforce PostgREST cache consistency.

-- 1. Create tutorial_progress table if missing
CREATE TABLE IF NOT EXISTS public.tutorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tutorial_id UUID REFERENCES public.tutorials(id) ON DELETE CASCADE NOT NULL,
    completed BOOLEAN DEFAULT true,
    last_accessed TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tutorial_id)
);

-- 2. Grant permissions (Crucial for PostgREST cache)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

-- 3. Enable RLS
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own progress' AND tablename = 'tutorial_progress') THEN
        CREATE POLICY "Users can manage their own progress" ON public.tutorial_progress 
        FOR ALL TO authenticated USING (auth.uid() = user_id);
    END IF;
END $$;

-- 5. Upgrade force_refresh_schema_permissions to include the new table
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Touch tables to refresh schema cache
    GRANT SELECT ON public.tutorials TO anon, authenticated;
    GRANT SELECT ON public.tutorial_progress TO authenticated;
    
    -- Notify PostgREST to reload schema
    NOTIFY pgrst, 'reload schema';
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO anon;

-- 6. Trigger immediate refresh
SELECT public.force_refresh_schema_permissions();