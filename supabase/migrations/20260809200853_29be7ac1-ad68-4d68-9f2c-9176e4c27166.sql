-- Step 1: Ensure metadata and vip_tier columns exist in profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_tier TEXT DEFAULT 'none';

-- Step 2: Fix/Update the force_refresh_schema_permissions to be more aggressive
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify PostgREST to reload its schema cache
  NOTIFY pgrst, 'reload schema';
  
  -- Grant permissions again just in case (PGRST108 often happens due to stale cache after ALTER)
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
  
  -- Run ANALYZE to update statistics which can sometimes help with query planning issues
  ANALYZE public.profiles;
END;
$$;

-- Step 3: Run the refresh immediately
SELECT public.force_refresh_schema_permissions();
