-- 1. Correcting integration_logs schema
ALTER TABLE public.integration_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Ensuring GRANTS are correct for all roles
GRANT ALL ON public.integration_logs TO service_role;
GRANT INSERT ON public.integration_logs TO authenticated, anon;
GRANT SELECT ON public.integration_logs TO authenticated;

-- 3. Fixing RLS for integration_logs
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read integration logs" ON public.integration_logs;
CREATE POLICY "Admins can read integration logs" ON public.integration_logs 
FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can insert logs" ON public.integration_logs;
CREATE POLICY "Authenticated can insert logs" ON public.integration_logs 
FOR INSERT TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can insert logs" ON public.integration_logs;
CREATE POLICY "Anon can insert logs" ON public.integration_logs 
FOR INSERT TO anon 
WITH CHECK (true);

-- 4. Refreshing schema cache
SELECT public.force_refresh_schema_permissions();
