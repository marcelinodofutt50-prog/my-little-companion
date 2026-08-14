DROP POLICY IF EXISTS "migration_waves_read_active" ON public.migration_waves;
REVOKE ALL ON public.migration_waves FROM authenticated, anon;
GRANT ALL ON public.migration_waves TO service_role;

CREATE POLICY "migration_waves_staff_read"
  ON public.migration_waves FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
GRANT SELECT ON public.migration_waves TO authenticated;