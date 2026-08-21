-- 1) Idempotência de resgate: um uso por pessoa por código
DELETE FROM public.redeem_code_uses a
 USING public.redeem_code_uses b
 WHERE a.code_id = b.code_id AND a.user_id = b.user_id AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_redeem_code_uses_code_user
  ON public.redeem_code_uses(code_id, user_id);

-- 2) Travas de operação (idempotência sob cliques repetidos / múltiplas sessões)
CREATE TABLE IF NOT EXISTS public.operation_locks (
  key text PRIMARY KEY,
  holder text,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

GRANT ALL ON public.operation_locks TO service_role;
ALTER TABLE public.operation_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_operation_locks" ON public.operation_locks
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.try_acquire_op_lock(_key text, _ttl_seconds integer DEFAULT 60, _holder text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ok boolean;
BEGIN
  DELETE FROM public.operation_locks WHERE key = _key AND expires_at < now();
  INSERT INTO public.operation_locks(key, holder, acquired_at, expires_at)
  VALUES (_key, _holder, now(), now() + make_interval(secs => GREATEST(_ttl_seconds, 1)))
  ON CONFLICT (key) DO NOTHING;
  GET DIAGNOSTICS ok = ROW_COUNT;
  RETURN ok;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_op_lock(_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$ DELETE FROM public.operation_locks WHERE key = _key; $$;

-- 3) Auditoria detalhada de licenças / logins
CREATE TABLE IF NOT EXISTS public.license_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid,
  user_id uuid,
  actor_id uuid,
  actor_kind text NOT NULL DEFAULT 'system' CHECK (actor_kind IN ('customer','staff','system','webhook')),
  event_type text NOT NULL,
  reason text,
  yaarsa_email text,
  panel text,
  expires_before timestamptz,
  expires_after timestamptz,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_audit_license ON public.license_audit_events(license_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_license_audit_user ON public.license_audit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_license_audit_created ON public.license_audit_events(created_at DESC);

GRANT SELECT ON public.license_audit_events TO authenticated;
GRANT ALL ON public.license_audit_events TO service_role;
ALTER TABLE public.license_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_license_audit" ON public.license_audit_events
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "user_read_own_license_audit" ON public.license_audit_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';