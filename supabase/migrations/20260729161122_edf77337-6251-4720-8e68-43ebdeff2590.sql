CREATE TABLE public.antifraud_allowlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL UNIQUE,
  reason text,
  created_by uuid,
  created_by_email text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.antifraud_allowlist TO authenticated;
GRANT ALL ON public.antifraud_allowlist TO service_role;

ALTER TABLE public.antifraud_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view antifraud allowlist"
ON public.antifraud_allowlist FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_antifraud_allowlist_hash ON public.antifraud_allowlist (ip_hash);