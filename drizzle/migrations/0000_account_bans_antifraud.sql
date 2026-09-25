CREATE TABLE IF NOT EXISTS public.account_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  source text NOT NULL DEFAULT 'auto',
  price_multiplier numeric NOT NULL DEFAULT 1.5,
  linked_group_id uuid,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid
);
GRANT SELECT ON public.account_bans TO authenticated;
GRANT ALL ON public.account_bans TO service_role;
ALTER TABLE public.account_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ban readable" ON public.account_bans FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.ban_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_id uuid NOT NULL REFERENCES public.account_bans(id) ON DELETE CASCADE,
  kind text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value, ban_id)
);
CREATE INDEX IF NOT EXISTS ban_fingerprints_lookup ON public.ban_fingerprints(kind, value);
GRANT SELECT ON public.ban_fingerprints TO authenticated;
GRANT ALL ON public.ban_fingerprints TO service_role;
ALTER TABLE public.ban_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read fingerprints" ON public.ban_fingerprints FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.trial_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash text,
  ip_hash text,
  terms_version text NOT NULL DEFAULT 'v2-3h30',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trial_consents_user ON public.trial_consents(user_id, created_at DESC);
GRANT SELECT ON public.trial_consents TO authenticated;
GRANT ALL ON public.trial_consents TO service_role;
ALTER TABLE public.trial_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own consents readable" ON public.trial_consents FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.community_strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_strikes_user ON public.community_strikes(user_id, created_at DESC);
GRANT SELECT ON public.community_strikes TO authenticated;
GRANT ALL ON public.community_strikes TO service_role;
ALTER TABLE public.community_strikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read strikes" ON public.community_strikes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));