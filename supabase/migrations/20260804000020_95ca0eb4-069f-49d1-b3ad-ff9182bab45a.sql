ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS password_fingerprint text,
  ADD COLUMN IF NOT EXISTS suspend_password_fingerprint text;