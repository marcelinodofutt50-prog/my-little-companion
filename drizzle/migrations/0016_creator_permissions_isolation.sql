-- Creator data is private; client writes must pass the existing owner/staff RPCs.
REVOKE ALL ON public.creator_videos, public.creator_license_claims, public.supporter_applications FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.creator_videos, public.creator_license_claims, public.supporter_applications FROM authenticated;
REVOKE UPDATE (status, staff_note, reviewed_by, reviewed_at) ON public.supporter_applications FROM authenticated;
GRANT SELECT ON public.creator_videos, public.creator_license_claims, public.supporter_applications TO authenticated;
GRANT ALL ON public.creator_videos, public.creator_license_claims, public.supporter_applications TO service_role;

CREATE OR REPLACE FUNCTION public.is_approved_creator(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL
    AND (_uid = auth.uid() OR (public.is_staff(auth.uid()) AND public.mfa_satisfied()))
  THEN (
    EXISTS (SELECT 1 FROM public.supporter_applications WHERE user_id = _uid AND status = 'approved')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text = 'admin')
  ) AND NOT public.is_account_banned(_uid)
  ELSE false END
$$;
REVOKE ALL ON FUNCTION public.is_approved_creator(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_creator(uuid) TO authenticated, service_role;

-- Preserve staff review transitions but derive attribution from the verified caller.
CREATE OR REPLACE FUNCTION public.review_supporter_application(_id uuid, _status text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) OR NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF _status IS NULL OR _status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'bad_status';
  END IF;
  UPDATE public.supporter_applications
  SET status = _status, staff_note = nullif(left(btrim(coalesce(_note,'')),300),''),
      reviewed_by = uid, reviewed_at = now()
  WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.review_supporter_application(uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_supporter_application(uuid,text,text) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';