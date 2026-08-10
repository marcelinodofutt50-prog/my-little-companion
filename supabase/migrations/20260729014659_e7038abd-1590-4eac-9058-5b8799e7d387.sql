ALTER TABLE public.apk_jobs ADD COLUMN IF NOT EXISTS cleared_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS apk_jobs_user_cleared_idx ON public.apk_jobs (user_id, cleared_at);