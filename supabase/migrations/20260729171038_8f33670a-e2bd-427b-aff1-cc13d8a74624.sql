CREATE TABLE public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  email_masked text,
  outcome text NOT NULL DEFAULT 'attempt',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.signup_attempts TO service_role;

ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read signup attempts"
  ON public.signup_attempts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX signup_attempts_ip_created_idx
  ON public.signup_attempts (ip_hash, created_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'cleanup-signup-attempts',
  '0 4 * * *',
  $$ DELETE FROM public.signup_attempts WHERE created_at < now() - interval '7 days'; $$
);