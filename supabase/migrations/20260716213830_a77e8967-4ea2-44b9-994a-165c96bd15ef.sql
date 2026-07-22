
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS version_tier text,
  ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legacy_server_fee_brl numeric;

UPDATE public.licenses
SET version_tier = CASE
  WHEN plan_slug ILIKE '%lifetime%' THEN 'lifetime_46'
  WHEN plan_slug ILIKE '%30d%' OR plan_slug ILIKE '%month%' THEN 'monthly_457'
  WHEN plan_slug ILIKE '%7d%' OR plan_slug ILIKE '%week%' THEN 'weekly'
  ELSE 'monthly_457'
END
WHERE version_tier IS NULL;
