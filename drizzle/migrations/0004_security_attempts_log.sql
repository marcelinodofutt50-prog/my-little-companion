CREATE TABLE IF NOT EXISTS public.security_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), kind text NOT NULL, user_id uuid, email text, ip text, user_agent text, details jsonb NOT NULL DEFAULT '{}'::jsonb);
GRANT SELECT ON public.security_attempts TO authenticated;
GRANT ALL ON public.security_attempts TO service_role;
ALTER TABLE public.security_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read security attempts" ON public.security_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS security_attempts_created_idx ON public.security_attempts (created_at DESC);