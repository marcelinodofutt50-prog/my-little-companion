CREATE TABLE public.signup_ip_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  email_masked text,
  user_id uuid,
  user_agent text,
  suspicious boolean NOT NULL DEFAULT false,
  accounts_in_window integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX signup_ip_log_hash_created_idx ON public.signup_ip_log (ip_hash, created_at DESC);
CREATE INDEX signup_ip_log_created_idx ON public.signup_ip_log (created_at DESC);

GRANT SELECT ON public.signup_ip_log TO authenticated;
GRANT ALL ON public.signup_ip_log TO service_role;

ALTER TABLE public.signup_ip_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view signup ip log"
ON public.signup_ip_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));