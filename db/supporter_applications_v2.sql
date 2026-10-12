-- Clientes só enviam pelo RPC (valida, limita reenvio, nunca muda status aprovado).
REVOKE INSERT, UPDATE ON public.supporter_applications FROM authenticated;
GRANT UPDATE (status, staff_note, reviewed_by, reviewed_at) ON public.supporter_applications TO authenticated;
DROP POLICY IF EXISTS sa_insert ON public.supporter_applications;
ALTER TABLE public.supporter_applications ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.submit_supporter_application(_links text, _plan text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); cur record; l text := btrim(coalesce(_links,'')); p text := btrim(coalesce(_plan,''));
BEGIN
  IF uid IS NULL OR NOT public.mfa_satisfied() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF EXISTS (SELECT 1 FROM account_bans b WHERE b.user_id = uid AND b.revoked_at IS NULL) THEN RAISE EXCEPTION 'banned'; END IF;
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

-- Equipe: só mexe em status/nota; quem revisou é sempre quem está logado.
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
DROP TRIGGER IF EXISTS supporter_app_review_guard ON public.supporter_applications;
CREATE TRIGGER supporter_app_review_guard BEFORE UPDATE ON public.supporter_applications FOR EACH ROW EXECUTE FUNCTION public.supporter_app_review_guard();
REVOKE ALL ON FUNCTION public.supporter_app_review_guard() FROM public, anon, authenticated;
NOTIFY pgrst, 'reload schema';
