-- Drop the function to fix the return type mismatch
DROP FUNCTION IF EXISTS public.force_refresh_schema_permissions();

-- Re-grant foundational usage permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Ensure tutorials table has correct permissions
GRANT SELECT ON public.tutorials TO anon, authenticated, service_role;
GRANT ALL ON public.tutorials TO service_role;

-- Ensure tutorial_progress has correct permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

-- Force a PostgREST schema reload
SELECT pg_notify('pgrst', 'reload schema');

-- Re-create function as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Re-apply grants
  GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
  GRANT SELECT ON public.tutorials TO authenticated, anon, service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated, service_role;
  
  -- Notify PostgREST
  PERFORM pg_notify('pgrst', 'reload schema');
  
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated, anon;
