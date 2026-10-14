-- Programa Creator: boas-vindas após aprovação, resgate da licença creator e envio de vídeos.
-- Clientes só escrevem via RPC (validação, limite diário, plataformas permitidas); equipe revisa via RPC.
ALTER TABLE public.supporter_applications ADD COLUMN IF NOT EXISTS welcome_seen_at timestamptz;

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
REVOKE ALL ON public.creator_videos FROM anon;
GRANT SELECT ON public.creator_videos TO authenticated;
GRANT ALL ON public.creator_videos TO service_role;
ALTER TABLE public.creator_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cv_select ON public.creator_videos;
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
REVOKE ALL ON public.creator_license_claims FROM anon;
GRANT SELECT ON public.creator_license_claims TO authenticated;
GRANT ALL ON public.creator_license_claims TO service_role;
ALTER TABLE public.creator_license_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clc_select ON public.creator_license_claims;
CREATE POLICY clc_select ON public.creator_license_claims FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_approved_creator(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM supporter_applications WHERE user_id = _uid AND status = 'approved')
     AND NOT EXISTS (SELECT 1 FROM account_bans b WHERE b.user_id = _uid AND b.revoked_at IS NULL)
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
