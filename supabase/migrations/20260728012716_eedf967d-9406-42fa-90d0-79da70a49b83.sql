REVOKE ALL ON public.recovery_codes FROM anon;
GRANT SELECT, INSERT, DELETE ON public.recovery_codes TO authenticated;
GRANT ALL ON public.recovery_codes TO service_role;

ALTER TABLE public.recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recovery_codes_select_own" ON public.recovery_codes;
DROP POLICY IF EXISTS "Users can read own recovery codes" ON public.recovery_codes;
DROP POLICY IF EXISTS "Users can insert own recovery codes" ON public.recovery_codes;
DROP POLICY IF EXISTS "Users can delete own recovery codes" ON public.recovery_codes;

CREATE POLICY "recovery_codes_read_own"
ON public.recovery_codes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "recovery_codes_create_own"
ON public.recovery_codes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recovery_codes_delete_own"
ON public.recovery_codes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS "profiles_update_security_fields" ON public.profiles;
CREATE POLICY "profiles_update_security_fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

NOTIFY pgrst, 'reload schema';