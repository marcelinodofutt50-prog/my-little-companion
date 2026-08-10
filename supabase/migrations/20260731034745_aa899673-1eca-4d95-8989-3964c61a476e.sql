ALTER TABLE public.migration_waves
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_deadline boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS test_base_url text,
  ADD COLUMN IF NOT EXISTS test_admin_key_enc text;

NOTIFY pgrst, 'reload schema';