-- 2FA aplicado no servidor: sessão aal1 de conta com 2FA ligado não lê nem grava nada.
CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NULL
      OR coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified');
$$;
REVOKE ALL ON FUNCTION public.mfa_satisfied() FROM public;
GRANT EXECUTE ON FUNCTION public.mfa_satisfied() TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.mfa_satisfied()
     AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity LOOP
    EXECUTE format('DROP POLICY IF EXISTS require_mfa_aal2 ON public.%I', t.tablename);
    EXECUTE format('CREATE POLICY require_mfa_aal2 ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied())', t.tablename);
  END LOOP;
END $$;
