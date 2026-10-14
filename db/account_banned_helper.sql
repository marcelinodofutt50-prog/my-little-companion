-- Funciona mesmo em bancos sem a tabela account_bans (produção antiga).
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
