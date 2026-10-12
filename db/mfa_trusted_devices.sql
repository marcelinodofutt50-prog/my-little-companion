CREATE TABLE IF NOT EXISTS public.mfa_trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.mfa_trusted_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  device_id uuid NOT NULL REFERENCES public.mfa_trusted_devices(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
REVOKE ALL ON public.mfa_trusted_devices, public.mfa_trusted_sessions FROM anon, authenticated;
GRANT ALL ON public.mfa_trusted_devices, public.mfa_trusted_sessions TO service_role;
ALTER TABLE public.mfa_trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_trusted_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mfa_satisfied() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NULL
      OR coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified')
      OR EXISTS (SELECT 1 FROM public.mfa_trusted_sessions s JOIN public.mfa_trusted_devices d ON d.id = s.device_id
                 WHERE s.session_id = nullif(auth.jwt() ->> 'session_id','')::uuid AND s.user_id = auth.uid()
                   AND s.expires_at > now() AND d.expires_at > now());
$$;

-- Só uma sessão que já passou pelo código (aal2) pode marcar o aparelho como confiável.
CREATE OR REPLACE FUNCTION public.trust_this_device(_label text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); tok text; did uuid;
BEGIN
  IF uid IS NULL OR coalesce(auth.jwt() ->> 'aal','aal1') <> 'aal2' THEN RAISE EXCEPTION 'aal2_required'; END IF;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO mfa_trusted_devices(user_id, token_hash, label, expires_at)
    VALUES (uid, encode(sha256(convert_to(tok,'UTF8')),'hex'), left(coalesce(_label,''),80), now() + interval '30 days') RETURNING id INTO did;
  DELETE FROM mfa_trusted_devices WHERE user_id = uid AND (expires_at < now() OR id NOT IN (
    SELECT id FROM mfa_trusted_devices WHERE user_id = uid ORDER BY created_at DESC LIMIT 5));
  RETURN tok;
END $$;

CREATE OR REPLACE FUNCTION public.redeem_trusted_device(_token text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); sid uuid := nullif(auth.jwt() ->> 'session_id','')::uuid; d record;
BEGIN
  IF uid IS NULL OR sid IS NULL OR _token IS NULL OR length(_token) <> 96 THEN RETURN false; END IF;
  SELECT * INTO d FROM mfa_trusted_devices WHERE token_hash = encode(sha256(convert_to(_token,'UTF8')),'hex') AND user_id = uid AND expires_at > now();
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO mfa_trusted_sessions(session_id, user_id, device_id, expires_at) VALUES (sid, uid, d.id, d.expires_at)
    ON CONFLICT (session_id) DO UPDATE SET device_id = EXCLUDED.device_id, expires_at = EXCLUDED.expires_at WHERE mfa_trusted_sessions.user_id = uid;
  UPDATE mfa_trusted_devices SET last_used_at = now() WHERE id = d.id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.list_my_trusted_devices() RETURNS TABLE(id uuid, label text, expires_at timestamptz, last_used_at timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, label, expires_at, last_used_at, created_at FROM mfa_trusted_devices
  WHERE user_id = auth.uid() AND expires_at > now() AND public.mfa_satisfied() ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.forget_my_trusted_devices() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.mfa_satisfied() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  DELETE FROM mfa_trusted_devices WHERE user_id = auth.uid(); GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.trust_this_device(text), public.redeem_trusted_device(text), public.list_my_trusted_devices(), public.forget_my_trusted_devices() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.trust_this_device(text), public.redeem_trusted_device(text), public.list_my_trusted_devices(), public.forget_my_trusted_devices() TO authenticated;
NOTIFY pgrst, 'reload schema';
