ALTER TABLE public.apk_jobs
  ADD COLUMN IF NOT EXISTS downloaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purge_after timestamptz,
  ADD COLUMN IF NOT EXISTS purged_at timestamptz;

CREATE INDEX IF NOT EXISTS apk_jobs_purge_idx
  ON public.apk_jobs (purge_after)
  WHERE purged_at IS NULL;