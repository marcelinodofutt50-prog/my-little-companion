CREATE OR REPLACE FUNCTION public.delete_my_creator_video(_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.mfa_satisfied() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  DELETE FROM creator_videos WHERE id = _id AND user_id = auth.uid() AND status = 'pending';
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.delete_my_creator_video(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_creator_video(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';