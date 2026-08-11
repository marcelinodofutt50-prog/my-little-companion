-- Shadow Protocol v47.0 — reparo de schema do Trial (projeto dvnksmqbpbzwgwmbnjjy)
-- Idempotente. Não altera dados de clientes.

-- 1) trials.ip_hash (antifraude por conexão)
ALTER TABLE public.trials ADD COLUMN IF NOT EXISTS ip_hash text;
CREATE INDEX IF NOT EXISTS idx_trials_ip_hash ON public.trials (ip_hash);

-- 2) licenses.status / origin_type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'license_status') THEN
    CREATE TYPE public.license_status AS ENUM
      ('trial','active','expiring_soon','expired','cancelled','revoked','suspended');
  END IF;
END $$;

ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS status public.license_status NOT NULL DEFAULT 'active';
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS origin_type text;

UPDATE public.licenses SET status = 'trial' WHERE is_trial = true AND status = 'active';
UPDATE public.licenses SET origin_type = CASE WHEN is_trial THEN 'trial' ELSE 'purchase' END WHERE origin_type IS NULL;

-- 3) trial_blocks (auditoria antifraude)
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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trial_blocks'
      AND policyname='Admins can view trial blocks'
  ) THEN
    CREATE POLICY "Admins can view trial blocks" ON public.trial_blocks
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
