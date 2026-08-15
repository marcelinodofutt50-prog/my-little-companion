DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='integration_logs' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.integration_logs', p.policyname);
  END LOOP;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.integration_logs FROM anon, authenticated;
GRANT ALL ON public.integration_logs TO service_role;