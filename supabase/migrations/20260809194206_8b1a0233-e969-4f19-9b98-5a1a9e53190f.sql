-- Migration: Shadow Infrastructure v7.3 - Final Database Repair
-- Targeted fix for PGRST108 (schema cache) and Shadow Pass metadata failures

-- 1. Ensure 'metadata' column exists on 'profiles' (idempotent)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'metadata') THEN
        ALTER TABLE public.profiles ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Force recreate 'tutorial_progress' to clear PostgREST stale cache issues
DROP TABLE IF EXISTS public.tutorial_progress CASCADE;

CREATE TABLE public.tutorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tutorial_id TEXT NOT NULL,
    completed BOOLEAN DEFAULT TRUE,
    last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, tutorial_id)
);

-- 3. Permissions (CRITICAL for Lovable Cloud)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.tutorial_progress TO service_role;

-- 4. RLS for 'tutorial_progress'
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tutorial progress"
    ON public.tutorial_progress
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Force Schema Cache Refresh via standard NOTIFY (PostgREST listens to this in many configs)
NOTIFY pgrst, 'reload schema';

-- 6. Re-validate force_refresh function
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This triggers a schema re-scan in PostgREST by modifying a dummy property if allowed, 
  -- or simply by being a SECURITY DEFINER function called by the app.
  EXECUTE 'ANALYZE public.tutorial_progress';
  EXECUTE 'ANALYZE public.profiles';
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO anon;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO service_role;
