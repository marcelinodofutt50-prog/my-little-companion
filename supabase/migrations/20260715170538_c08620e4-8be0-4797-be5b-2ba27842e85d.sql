
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by text,
  ADD COLUMN IF NOT EXISTS expires_at_before_suspend timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
