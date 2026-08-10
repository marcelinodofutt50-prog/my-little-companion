CREATE TABLE IF NOT EXISTS public.apk_free_trials (
  user_id uuid PRIMARY KEY,
  job_id uuid,
  used_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.apk_free_trials TO authenticated;
GRANT ALL ON public.apk_free_trials TO service_role;
ALTER TABLE public.apk_free_trials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own apk free trial read" ON public.apk_free_trials;
CREATE POLICY "own apk free trial read" ON public.apk_free_trials
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- Backfill: quem já usou o teste grátis continua marcado.
INSERT INTO public.apk_free_trials (user_id, job_id, used_at)
SELECT DISTINCT ON (user_id) user_id, id, created_at
  FROM public.apk_jobs
 WHERE is_free_trial = true
 ORDER BY user_id, created_at ASC
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_apk_job_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' OR public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.user_id := OLD.user_id;
  NEW.is_free_trial := OLD.is_free_trial;
  NEW.source_path := OLD.source_path;
  NEW.result_path := OLD.result_path;
  NEW.result_filename := OLD.result_filename;
  NEW.cleared_at := OLD.cleared_at;
  NEW.queued_at := OLD.queued_at;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_apk_job_client_update ON public.apk_jobs;
CREATE TRIGGER trg_apk_job_client_update
  BEFORE UPDATE ON public.apk_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_apk_job_client_update();