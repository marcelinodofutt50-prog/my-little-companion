GRANT SELECT ON public.recovery_codes TO authenticated;
GRANT ALL ON public.recovery_codes TO service_role;

DROP POLICY IF EXISTS "Users can read own recovery codes" ON public.recovery_codes;
CREATE POLICY "Users can read own recovery codes"
ON public.recovery_codes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);