CREATE TABLE public.migration_wave_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id uuid NOT NULL REFERENCES public.migration_waves(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approve boolean NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wave_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.migration_wave_votes TO authenticated;
GRANT ALL ON public.migration_wave_votes TO service_role;

ALTER TABLE public.migration_wave_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_votes_select" ON public.migration_wave_votes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "own_votes_insert" ON public.migration_wave_votes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_votes_update" ON public.migration_wave_votes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_votes_delete" ON public.migration_wave_votes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER migration_wave_votes_updated_at
  BEFORE UPDATE ON public.migration_wave_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();