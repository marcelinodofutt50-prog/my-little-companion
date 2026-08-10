
-- APK job queue for Play Protect
CREATE TYPE public.apk_job_status AS ENUM (
  'queued','claimed','sending','processing','done','failed','expired','cancelled'
);

CREATE TABLE public.apk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.apk_job_status NOT NULL DEFAULT 'queued',
  source_path text NOT NULL,           -- storage path in apk-uploads
  source_filename text NOT NULL,
  source_size_bytes bigint NOT NULL,
  result_path text,                    -- storage path in apk-results
  result_filename text,
  result_size_bytes bigint,
  is_free_trial boolean NOT NULL DEFAULT false,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  error_message text,
  worker_id text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_apk_jobs_user ON public.apk_jobs(user_id, created_at DESC);
CREATE INDEX idx_apk_jobs_queue ON public.apk_jobs(status, queued_at) WHERE status IN ('queued','claimed','sending','processing');

GRANT SELECT, INSERT, UPDATE ON public.apk_jobs TO authenticated;
GRANT ALL ON public.apk_jobs TO service_role;

ALTER TABLE public.apk_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own apk jobs"  ON public.apk_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own apk jobs" ON public.apk_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users cancel own queued"   ON public.apk_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'queued')
  WITH CHECK (auth.uid() = user_id AND status IN ('queued','cancelled'));
CREATE POLICY "admins manage apk jobs"    ON public.apk_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_apk_jobs_updated BEFORE UPDATE ON public.apk_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.apk_jobs;

-- Storage RLS: users read/write own files in apk-uploads and read own in apk-results
CREATE POLICY "users read own apk-uploads" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'apk-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users upload own apk-uploads" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'apk-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users read own apk-results" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'apk-results' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Play Protect monthly plan (R$ 450)
INSERT INTO public.plans (slug, name, description, price_brl, days, category, active, sort_order)
VALUES ('play-protect-monthly',
        'Play Protect — Mensal',
        'Bypass Play Protect ilimitado por 30 dias. Envie APKs sem limite e receba a versão tratada.',
        450, 30, 'addon', true, 90)
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, price_brl=EXCLUDED.price_brl,
  days=EXCLUDED.days, category=EXCLUDED.category, active=true, sort_order=EXCLUDED.sort_order;

-- Entitlement helper: active paid Play Protect license?
CREATE OR REPLACE FUNCTION public.has_active_play_protect(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.licenses l
    WHERE l.user_id = _user_id
      AND l.plan_slug = 'play-protect-monthly'
      AND l.disabled_at IS NULL
      AND l.revoked = false
      AND (l.expires_at IS NULL OR l.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_play_protect(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_play_protect(uuid) TO authenticated, service_role;

-- TTL cleanup: mark expired jobs
CREATE OR REPLACE FUNCTION public.expire_stale_apk_jobs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.apk_jobs
     SET status = 'expired'
   WHERE status IN ('queued','claimed','sending','processing')
     AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION public.expire_stale_apk_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_apk_jobs() TO service_role;
