REVOKE ALL ON public.recovery_codes FROM anon;
GRANT SELECT, INSERT, DELETE ON public.recovery_codes TO authenticated;
GRANT ALL ON public.recovery_codes TO service_role;

DROP POLICY IF EXISTS "Users can insert own recovery codes" ON public.recovery_codes;
CREATE POLICY "Users can insert own recovery codes"
ON public.recovery_codes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own recovery codes" ON public.recovery_codes;
CREATE POLICY "Users can delete own recovery codes"
ON public.recovery_codes FOR DELETE TO authenticated
USING (auth.uid() = user_id);