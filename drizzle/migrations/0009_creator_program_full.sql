CREATE OR REPLACE FUNCTION public.is_account_banned(_uid uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r boolean := false;
BEGIN
  IF to_regclass('public.account_bans') IS NULL THEN RETURN false; END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.account_bans WHERE user_id = $1 AND revoked_at IS NULL)' INTO r USING _uid;
  RETURN coalesce(r, false);
END $$;
REVOKE ALL ON FUNCTION public.is_account_banned(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_account_banned(uuid) TO authenticated;

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

CREATE TABLE IF NOT EXISTS public.supporter_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  channel_links text NOT NULL CHECK (char_length(channel_links) BETWEEN 5 AND 600),
  plan text NOT NULL DEFAULT '' CHECK (char_length(plan) <= 600),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  staff_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  welcome_seen_at timestamptz
);
GRANT SELECT ON public.supporter_applications TO authenticated;
GRANT UPDATE (status, staff_note, reviewed_by, reviewed_at) ON public.supporter_applications TO authenticated;
GRANT ALL ON public.supporter_applications TO service_role;
ALTER TABLE public.supporter_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY sa_select ON public.supporter_applications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY sa_staff_update ON public.supporter_applications FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY require_mfa_aal2 ON public.supporter_applications AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());

CREATE OR REPLACE FUNCTION public.submit_supporter_application(_links text, _plan text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); cur record; l text := btrim(coalesce(_links,'')); p text := btrim(coalesce(_plan,''));
BEGIN
  IF uid IS NULL OR NOT public.mfa_satisfied() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF public.is_account_banned(uid) THEN RAISE EXCEPTION 'banned'; END IF;
  IF char_length(l) < 10 OR char_length(l) > 600 OR l !~* 'https?://' THEN RAISE EXCEPTION 'invalid_links'; END IF;
  IF char_length(p) > 600 THEN RAISE EXCEPTION 'invalid_plan'; END IF;
  SELECT * INTO cur FROM supporter_applications WHERE user_id = uid FOR UPDATE;
  IF FOUND THEN
    IF cur.status IN ('approved','pending') THEN RETURN cur.status; END IF;
    IF cur.reviewed_at > now() - interval '24 hours' THEN RAISE EXCEPTION 'wait_24h'; END IF;
    UPDATE supporter_applications SET channel_links = l, plan = p, status = 'pending', staff_note = NULL, reviewed_by = NULL, reviewed_at = NULL, updated_at = now() WHERE user_id = uid;
  ELSE
    INSERT INTO supporter_applications(user_id, channel_links, plan) VALUES (uid, l, p);
  END IF;
  RETURN 'pending';
END $$;
REVOKE ALL ON FUNCTION public.submit_supporter_application(text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_supporter_application(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.supporter_app_review_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND current_user = 'authenticated' THEN
    IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
    IF NEW.status NOT IN ('approved','rejected','pending') THEN RAISE EXCEPTION 'bad_status'; END IF;
    NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
    NEW.staff_note := left(NEW.staff_note, 300);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER supporter_app_review_guard BEFORE UPDATE ON public.supporter_applications FOR EACH ROW EXECUTE FUNCTION public.supporter_app_review_guard();
REVOKE ALL ON FUNCTION public.supporter_app_review_guard() FROM public, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.creator_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  url text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'outro',
  status text NOT NULL DEFAULT 'pending',
  staff_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_videos_user_idx ON public.creator_videos(user_id, created_at DESC);
GRANT SELECT ON public.creator_videos TO authenticated;
GRANT ALL ON public.creator_videos TO service_role;
ALTER TABLE public.creator_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cv_select ON public.creator_videos FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.creator_license_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'requested',
  staff_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creator_license_claims TO authenticated;
GRANT ALL ON public.creator_license_claims TO service_role;
ALTER TABLE public.creator_license_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY clc_select ON public.creator_license_claims FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_approved_creator(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM supporter_applications WHERE user_id = _uid AND status = 'approved')
     AND NOT public.is_account_banned(_uid)
$$;
REVOKE ALL ON FUNCTION public.is_approved_creator(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_creator(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_creator_welcome_seen() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE supporter_applications SET welcome_seen_at = now() WHERE user_id = auth.uid() AND status = 'approved' AND welcome_seen_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.mark_creator_welcome_seen() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_creator_welcome_seen() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_creator_license() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); cur record;
BEGIN
  IF uid IS NULL OR NOT public.mfa_satisfied() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF NOT public.is_approved_creator(uid) THEN RAISE EXCEPTION 'not_creator'; END IF;
  SELECT * INTO cur FROM creator_license_claims WHERE user_id = uid FOR UPDATE;
  IF FOUND THEN
    IF cur.status = 'rejected' AND cur.reviewed_at < now() - interval '24 hours' THEN
      UPDATE creator_license_claims SET status = 'requested', staff_note = NULL, reviewed_by = NULL, reviewed_at = NULL, created_at = now() WHERE user_id = uid;
      RETURN 'requested';
    END IF;
    RETURN cur.status;
  END IF;
  INSERT INTO creator_license_claims(user_id) VALUES (uid);
  RETURN 'requested';
END $$;
REVOKE ALL ON FUNCTION public.claim_creator_license() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_creator_license() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_creator_video(_url text, _title text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); u text := btrim(coalesce(_url,'')); t text := left(btrim(coalesce(_title,'')), 120); host text; plat text; nid uuid;
BEGIN
  IF uid IS NULL OR NOT public.mfa_satisfied() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF NOT public.is_approved_creator(uid) THEN RAISE EXCEPTION 'not_creator'; END IF;
  IF char_length(u) > 300 OR u !~* '^https://[^[:space:]<>"'']+$' THEN RAISE EXCEPTION 'invalid_url'; END IF;
  host := regexp_replace(lower(substring(u from '^https://([^/:?#]+)')), '^(www\.|m\.)', '');
  plat := CASE
    WHEN host IN ('youtube.com','youtu.be') THEN 'youtube'
    WHEN host IN ('tiktok.com','vm.tiktok.com') THEN 'tiktok'
    WHEN host = 'instagram.com' THEN 'instagram'
    WHEN host IN ('kwai.com','k.kwai.com') THEN 'kwai'
    WHEN host IN ('facebook.com','fb.watch') THEN 'facebook'
    WHEN host IN ('t.me','telegram.me') THEN 'telegram'
    WHEN host IN ('x.com','twitter.com') THEN 'x'
    ELSE NULL END;
  IF plat IS NULL THEN RAISE EXCEPTION 'platform_not_allowed'; END IF;
  IF (SELECT count(*) FROM creator_videos WHERE user_id = uid AND created_at > now() - interval '24 hours') >= 5 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  IF EXISTS (SELECT 1 FROM creator_videos WHERE url = u) THEN RAISE EXCEPTION 'duplicate'; END IF;
  INSERT INTO creator_videos(user_id, url, title, platform) VALUES (uid, u, t, plat) RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.submit_creator_video(text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_creator_video(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_creator_item(_kind text, _id uuid, _status text, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); n text := nullif(left(btrim(coalesce(_note,'')), 300), '');
BEGIN
  IF uid IS NULL OR NOT public.mfa_satisfied() OR NOT public.is_staff(uid) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _kind = 'video' THEN
    IF _status NOT IN ('pending','approved','rejected') THEN RAISE EXCEPTION 'bad_status'; END IF;
    UPDATE creator_videos SET status = _status, staff_note = n, reviewed_by = uid, reviewed_at = now() WHERE id = _id;
  ELSIF _kind = 'claim' THEN
    IF _status NOT IN ('requested','delivered','rejected') THEN RAISE EXCEPTION 'bad_status'; END IF;
    UPDATE creator_license_claims SET status = _status, staff_note = n, reviewed_by = uid, reviewed_at = now() WHERE id = _id;
  ELSE RAISE EXCEPTION 'bad_kind'; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.review_creator_item(text,uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_creator_item(text,uuid,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';