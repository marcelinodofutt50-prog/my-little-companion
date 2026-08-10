ALTER TABLE public.migration_waves
  ADD COLUMN IF NOT EXISTS test_base_url text,
  ADD COLUMN IF NOT EXISTS test_admin_key_enc text;