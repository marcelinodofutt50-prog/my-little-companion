-- 1) Device identities
CREATE TABLE IF NOT EXISTS public.device_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_hash text NOT NULL,
  attrs_hash text,
  ip_hash text,
  ip_prefix_hash text,
  user_agent text,
  seen_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_identities_user_device_key UNIQUE (user_id, device_hash)
);

GRANT ALL ON public.device_identities TO service_role;
GRANT SELECT ON public.device_identities TO authenticated;
ALTER TABLE public.device_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_identities_admin_read" ON public.device_identities;
CREATE POLICY "device_identities_admin_read" ON public.device_identities
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS device_identities_device_idx ON public.device_identities (device_hash);
CREATE INDEX IF NOT EXISTS device_identities_attrs_idx ON public.device_identities (attrs_hash);
CREATE INDEX IF NOT EXISTS device_identities_ipprefix_idx ON public.device_identities (ip_prefix_hash);
CREATE INDEX IF NOT EXISTS device_identities_user_idx ON public.device_identities (user_id);

DROP TRIGGER IF EXISTS trg_device_identities_updated ON public.device_identities;
CREATE TRIGGER trg_device_identities_updated BEFORE UPDATE ON public.device_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Fraud assessments (auditoria de decisões)
CREATE TABLE IF NOT EXISTS public.fraud_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  decision text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  device_hash text,
  attrs_hash text,
  ip_hash text,
  ip_prefix_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.fraud_assessments TO service_role;
GRANT SELECT ON public.fraud_assessments TO authenticated;
ALTER TABLE public.fraud_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fraud_assessments_admin_read" ON public.fraud_assessments;
CREATE POLICY "fraud_assessments_admin_read" ON public.fraud_assessments
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS fraud_assessments_user_idx ON public.fraud_assessments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_assessments_device_idx ON public.fraud_assessments (device_hash);

-- 3) Sinais no resgate de trial
ALTER TABLE public.trials ADD COLUMN IF NOT EXISTS device_hash text;
ALTER TABLE public.trials ADD COLUMN IF NOT EXISTS attrs_hash text;
ALTER TABLE public.trials ADD COLUMN IF NOT EXISTS ip_prefix_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS trials_one_per_device_idx
  ON public.trials (device_hash) WHERE device_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS trials_attrs_idx ON public.trials (attrs_hash);
CREATE INDEX IF NOT EXISTS trials_ipprefix_idx ON public.trials (ip_prefix_hash);

-- 4) Sinais no teste grátis do Play Protect
ALTER TABLE public.apk_free_trials ADD COLUMN IF NOT EXISTS device_hash text;
ALTER TABLE public.apk_free_trials ADD COLUMN IF NOT EXISTS attrs_hash text;
ALTER TABLE public.apk_free_trials ADD COLUMN IF NOT EXISTS ip_hash text;
ALTER TABLE public.apk_free_trials ADD COLUMN IF NOT EXISTS ip_prefix_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS apk_free_trials_one_per_device_idx
  ON public.apk_free_trials (device_hash) WHERE device_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS apk_free_trials_attrs_idx ON public.apk_free_trials (attrs_hash);

-- 5) Identidade canônica de e-mail
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_canonical text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_device_hash text;

UPDATE public.profiles
   SET email_canonical = CASE
     WHEN lower(split_part(email, '@', 2)) IN ('gmail.com','googlemail.com')
       THEN replace(split_part(lower(split_part(email, '@', 1)), '+', 1), '.', '') || '@gmail.com'
     ELSE split_part(lower(split_part(email, '@', 1)), '+', 1) || '@' || lower(split_part(email, '@', 2))
   END
 WHERE email IS NOT NULL AND position('@' in email) > 1 AND email_canonical IS NULL;

CREATE INDEX IF NOT EXISTS profiles_email_canonical_idx ON public.profiles (email_canonical);
CREATE INDEX IF NOT EXISTS profiles_signup_device_idx ON public.profiles (signup_device_hash);

NOTIFY pgrst, 'reload schema';