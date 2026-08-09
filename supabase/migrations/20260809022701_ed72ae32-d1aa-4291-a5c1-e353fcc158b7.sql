-- Force table creation if it somehow exists but is broken, or create if missing
CREATE TABLE IF NOT EXISTS public.tutorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tutorial_id TEXT NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tutorial_id)
);

-- GRANT permissions (Crucial for PostgREST cache bridge)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

-- Enable RLS
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

-- Recreate policy to ensure it's clean
DROP POLICY IF EXISTS "Users can manage their own progress" ON public.tutorial_progress;
CREATE POLICY "Users can manage their own progress"
ON public.tutorial_progress
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure schema refresh function is absolute
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This triggers the internal reload of PostgREST cache
    NOTIFY pgrst, 'reload schema';
    
    -- Force physical activity on the table to wake up the bridge
    ANALYZE tutorial_progress;
    ANALYZE tutorials;
    
    -- Optional: a tiny write-read cycle if needed, but ANALYZE is usually enough
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO service_role;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO anon;

-- Verification
SELECT 1 as "deployment_fix_complete";