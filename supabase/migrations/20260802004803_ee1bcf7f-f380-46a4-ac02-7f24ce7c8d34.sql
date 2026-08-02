ALTER TABLE public.trials
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS trials_ip_hash_idx ON public.trials (ip_hash);

CREATE TABLE IF NOT EXISTS public.trial_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_hash text,
  email_masked text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.trial_blocks TO service_role;
ALTER TABLE public.trial_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view trial blocks"
  ON public.trial_blocks FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

GRANT SELECT ON public.trial_blocks TO authenticated;

CREATE INDEX IF NOT EXISTS trial_blocks_created_idx ON public.trial_blocks (created_at DESC);