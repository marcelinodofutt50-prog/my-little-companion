ALTER TABLE public.migration_waves
  ADD COLUMN IF NOT EXISTS has_deadline boolean NOT NULL DEFAULT true;