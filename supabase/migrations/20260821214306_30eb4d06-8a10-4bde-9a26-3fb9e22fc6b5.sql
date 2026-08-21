ALTER TABLE public.redeem_codes
  ADD COLUMN IF NOT EXISTS target_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_redeem_codes_target_user
  ON public.redeem_codes(target_user_id)
  WHERE target_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reserve_redeem_code(_code text)
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
  v_user_id uuid := auth.uid();
  v_code public.redeem_codes%ROWTYPE;
  v_claim_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_code
  FROM public.redeem_codes
  WHERE code = upper(regexp_replace(trim(_code), '\s+', '', 'g'))
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Código não encontrado. Confira as letras e tente de novo.'; END IF;
  IF NOT v_code.active THEN RAISE EXCEPTION 'Este código foi desativado pela equipe.'; END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at <= now() THEN RAISE EXCEPTION 'Este código já venceu.'; END IF;
  IF v_code.max_uses > 0 AND v_code.uses >= v_code.max_uses THEN RAISE EXCEPTION 'Este código já atingiu o limite de usos.'; END IF;
  IF v_code.target_user_id IS NOT NULL AND v_code.target_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Este código pertence a outro membro.';
  END IF;

  BEGIN
    INSERT INTO public.redeem_code_uses(code_id, code, user_id, details)
    VALUES (v_code.id, v_code.code, v_user_id,
      jsonb_build_object('status','claimed','kind',v_code.kind,'days',v_code.days))
    RETURNING id INTO v_claim_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Você já resgatou este código.';
  END;

  UPDATE public.redeem_codes SET uses = uses + 1 WHERE id = v_code.id;

  RETURN QUERY SELECT v_claim_id, v_code.id, v_code.kind, v_code.days, v_code.plan_slug, v_code.note;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_redeem_code_claim(_claim_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.redeem_code_uses
  WHERE id = _claim_id AND user_id = _user_id
    AND coalesce(details->>'status','') = 'claimed'
  RETURNING code_id INTO v_code_id;

  IF v_code_id IS NULL THEN RETURN false; END IF;
  UPDATE public.redeem_codes SET uses = greatest(uses - 1, 0) WHERE id = v_code_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_redeem_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_redeem_code(text) TO authenticated;
REVOKE ALL ON FUNCTION public.release_redeem_code_claim(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_redeem_code_claim(uuid, uuid) TO service_role;

CREATE TABLE public.community_giveaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone integer NOT NULL UNIQUE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  eligible_count integer NOT NULL DEFAULT 0,
  winner_count integer NOT NULL DEFAULT 5 CHECK (winner_count BETWEEN 1 AND 50),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.community_giveaways TO service_role;
ALTER TABLE public.community_giveaways ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.community_giveaway_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id uuid NOT NULL REFERENCES public.community_giveaways(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position integer NOT NULL,
  prize_kind text NOT NULL CHECK (prize_kind IN ('weekly','monthly','lifetime')),
  prize_days integer NOT NULL CHECK (prize_days IN (7,30,36500)),
  plan_slug text NOT NULL,
  redeem_code_id uuid NOT NULL REFERENCES public.redeem_codes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(giveaway_id, user_id),
  UNIQUE(giveaway_id, position)
);
GRANT ALL ON public.community_giveaway_winners TO service_role;
ALTER TABLE public.community_giveaway_winners ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_community_giveaway_winners_user ON public.community_giveaway_winners(user_id);

CREATE TRIGGER trg_community_giveaways_updated
  BEFORE UPDATE ON public.community_giveaways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.community_giveaways(milestone, title, winner_count)
VALUES (1000, 'Sorteio de 1.000 membros', 5)
ON CONFLICT (milestone) DO NOTHING;

CREATE OR REPLACE FUNCTION public.run_community_giveaway(_milestone integer DEFAULT 1000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_giveaway public.community_giveaways%ROWTYPE;
  v_eligible integer;
  v_selected integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_giveaway
  FROM public.community_giveaways
  WHERE milestone = _milestone
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada.'; END IF;
  IF v_giveaway.status = 'completed' THEN
    RETURN jsonb_build_object('status','completed','eligible_count',v_giveaway.eligible_count,'winner_count',v_giveaway.winner_count);
  END IF;

  SELECT count(*) INTO v_eligible
  FROM public.profiles p
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role IN ('admin','moderator','support'))
    AND NOT EXISTS (SELECT 1 FROM public.trial_blocks tb WHERE tb.user_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.fraud_assessments fa WHERE fa.user_id = p.id AND lower(fa.decision) = 'deny');

  UPDATE public.community_giveaways SET eligible_count = v_eligible WHERE id = v_giveaway.id;

  IF v_eligible < v_giveaway.milestone THEN
    RETURN jsonb_build_object('status','pending','eligible_count',v_eligible,'milestone',v_giveaway.milestone);
  END IF;

  WITH eligible AS (
    SELECT p.id, row_number() OVER (ORDER BY random())::integer AS pos
    FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role IN ('admin','moderator','support'))
      AND NOT EXISTS (SELECT 1 FROM public.trial_blocks tb WHERE tb.user_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.fraud_assessments fa WHERE fa.user_id = p.id AND lower(fa.decision) = 'deny')
    ORDER BY random()
    LIMIT v_giveaway.winner_count
  ), prizes AS (
    SELECT id, pos,
      CASE WHEN pos = 1 THEN 'lifetime' WHEN pos <= 3 THEN 'monthly' ELSE 'weekly' END AS prize_kind,
      CASE WHEN pos = 1 THEN 36500 WHEN pos <= 3 THEN 30 ELSE 7 END AS prize_days,
      CASE WHEN pos = 1 THEN 'login-lifetime' WHEN pos <= 3 THEN 'login-30d' ELSE 'login-7d' END AS plan_slug
    FROM eligible
  ), codes AS (
    INSERT INTO public.redeem_codes(code, kind, days, plan_slug, max_uses, expires_at, note, target_user_id)
    SELECT 'WIN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)) || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
      'license_days', prize_days, plan_slug, 1, now() + interval '365 days',
      'Prêmio do sorteio de 1.000 membros', id
    FROM prizes
    RETURNING id, target_user_id, days, plan_slug
  )
  INSERT INTO public.community_giveaway_winners(giveaway_id,user_id,position,prize_kind,prize_days,plan_slug,redeem_code_id)
  SELECT v_giveaway.id, p.id, p.pos, p.prize_kind, p.prize_days, p.plan_slug, c.id
  FROM prizes p JOIN codes c ON c.target_user_id = p.id;

  GET DIAGNOSTICS v_selected = ROW_COUNT;
  IF v_selected <> v_giveaway.winner_count THEN RAISE EXCEPTION 'Não foi possível selecionar todos os vencedores.'; END IF;

  UPDATE public.community_giveaways
  SET status='completed', eligible_count=v_eligible, completed_at=now()
  WHERE id=v_giveaway.id;

  RETURN jsonb_build_object('status','completed','eligible_count',v_eligible,'winner_count',v_selected);
END;
$$;

REVOKE ALL ON FUNCTION public.run_community_giveaway(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_community_giveaway(integer) TO service_role;

NOTIFY pgrst, 'reload schema';