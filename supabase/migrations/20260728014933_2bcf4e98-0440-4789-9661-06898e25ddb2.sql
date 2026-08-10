CREATE OR REPLACE FUNCTION public.generate_my_recovery_codes()
RETURNS TABLE(code text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _bytes bytea;
  _plain text;
  i int;
  j int;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.recovery_codes
   WHERE user_id = _user_id;

  FOR i IN 1..8 LOOP
    _bytes := gen_random_bytes(8);
    _plain := 'SHDW-';

    FOR j IN 0..3 LOOP
      _plain := _plain || substr(_alphabet, (get_byte(_bytes, j) % length(_alphabet)) + 1, 1);
    END LOOP;

    _plain := _plain || '-';

    FOR j IN 4..7 LOOP
      _plain := _plain || substr(_alphabet, (get_byte(_bytes, j) % length(_alphabet)) + 1, 1);
    END LOOP;

    INSERT INTO public.recovery_codes (user_id, code_hash)
    VALUES (
      _user_id,
      encode(digest(convert_to('shadow-recovery:' || replace(_plain, '-', ''), 'UTF8'), 'sha256'), 'hex')
    );

    code := _plain;
    RETURN NEXT;
  END LOOP;

  UPDATE public.profiles
     SET recovery_codes_generated_at = now(),
         security_ack_at = COALESCE(security_ack_at, now())
   WHERE id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_my_recovery_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_my_recovery_codes() TO authenticated;

NOTIFY pgrst, 'reload schema';