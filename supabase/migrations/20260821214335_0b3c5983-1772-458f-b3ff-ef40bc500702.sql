DROP FUNCTION IF EXISTS public.reserve_redeem_code(text);

CREATE OR REPLACE FUNCTION public.reserve_redeem_code(_code text, _user_id uuid)
RETURNS TABLE(
  claim_id uuid,
  code_id uuid,
  kind text,
  days integer,
  plan_slug text,
  note text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.redeem_codes%ROWTYPE;
  v_claim_id uuid;
BEGIN
  IF auth.role() <> 'service_role' OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_code
  FROM public.redeem_codes
  WHERE code = upper(regexp_replace(trim(_code), '\s+', '', 'g'))
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Código não encontrado. Confira as letras e tente de novo.'; END IF;
  IF NOT v_code.active THEN RAISE EXCEPTION 'Este código foi desativado pela equipe.'; END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at <= now() THEN RAISE EXCEPTION 'Este código já venceu.'; END IF;
  IF v_code.max_uses > 0 AND v_code.uses >= v_code.max_uses THEN RAISE EXCEPTION 'Este código já atingiu o limite de usos.'; END IF;
  IF v_code.target_user_id IS NOT NULL AND v_code.target_user_id <> _user_id THEN
    RAISE EXCEPTION 'Este código pertence a outro membro.';
  END IF;

  BEGIN
    INSERT INTO public.redeem_code_uses(code_id, code, user_id, details)
    VALUES (v_code.id, v_code.code, _user_id,
      jsonb_build_object('status','claimed','kind',v_code.kind,'days',v_code.days))
    RETURNING id INTO v_claim_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Você já resgatou este código.';
  END;

  UPDATE public.redeem_codes SET uses = uses + 1 WHERE id = v_code.id;
  RETURN QUERY SELECT v_claim_id, v_code.id, v_code.kind, v_code.days, v_code.plan_slug, v_code.note;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_redeem_code(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_redeem_code(text, uuid) TO service_role;

CREATE POLICY "giveaways_internal_only" ON public.community_giveaways
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "giveaway_winners_internal_only" ON public.community_giveaway_winners
  FOR ALL TO authenticated USING (false) WITH CHECK (false);