CREATE TABLE public.migration_waves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel text NOT NULL CHECK (panel IN ('v455','v457','v46')),
  title text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  server_label text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL,
  closed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.migration_waves TO authenticated;
GRANT ALL ON public.migration_waves TO service_role;

ALTER TABLE public.migration_waves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "migration_waves_read_active"
  ON public.migration_waves FOR SELECT TO authenticated
  USING (is_active = true OR public.is_staff(auth.uid()));

CREATE INDEX migration_waves_active_idx ON public.migration_waves (panel, is_active);

CREATE TABLE public.migration_wave_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id uuid NOT NULL REFERENCES public.migration_waves(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  old_license_id uuid NOT NULL,
  new_license_id uuid,
  status text NOT NULL DEFAULT 'migrated',
  old_revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wave_id, old_license_id)
);

GRANT SELECT ON public.migration_wave_claims TO authenticated;
GRANT ALL ON public.migration_wave_claims TO service_role;

ALTER TABLE public.migration_wave_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "migration_wave_claims_read_own"
  ON public.migration_wave_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE INDEX migration_wave_claims_wave_idx ON public.migration_wave_claims (wave_id);
CREATE INDEX migration_wave_claims_user_idx ON public.migration_wave_claims (user_id);

CREATE TRIGGER migration_waves_updated_at
  BEFORE UPDATE ON public.migration_waves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();