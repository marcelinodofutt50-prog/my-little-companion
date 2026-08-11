-- ============================================================
-- SHADOW PROTOCOL v49.0 — Paridade Loyalty / Missões / VIP
-- Alvo: projeto de produção dvnksmqbpbzwgwmbnjjy
-- Idempotente: pode ser reexecutado com segurança.
-- ============================================================

-- 0. Tipos ---------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.loyalty_tier AS ENUM ('starter','member','bronze','silver','gold','vip','elite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Colunas de pontos no perfil -----------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reward_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points_earned integer NOT NULL DEFAULT 0;

-- 2. Configuração de tiers -----------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_tier_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier public.loyalty_tier NOT NULL UNIQUE,
  name text NOT NULL,
  min_points integer NOT NULL DEFAULT 0,
  min_days_active integer NOT NULL DEFAULT 0,
  badge_url text,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_tier_config TO authenticated, anon;
GRANT ALL ON public.loyalty_tier_config TO service_role;
ALTER TABLE public.loyalty_tier_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tier config readable" ON public.loyalty_tier_config;
CREATE POLICY "tier config readable" ON public.loyalty_tier_config FOR SELECT USING (true);

-- 3. Saldo de fidelidade -------------------------------------
CREATE TABLE IF NOT EXISTS public.user_loyalty (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  current_tier public.loyalty_tier NOT NULL DEFAULT 'starter',
  total_spent numeric NOT NULL DEFAULT 0,
  days_active integer NOT NULL DEFAULT 0,
  last_action_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_loyalty TO authenticated;
GRANT ALL ON public.user_loyalty TO service_role;
ALTER TABLE public.user_loyalty ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own loyalty" ON public.user_loyalty;
CREATE POLICY "own loyalty" ON public.user_loyalty FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. Missões --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  difficulty text NOT NULL DEFAULT 'easy',
  reward_points integer NOT NULL DEFAULT 0,
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  limit_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_missions TO authenticated;
GRANT ALL ON public.loyalty_missions TO service_role;
ALTER TABLE public.loyalty_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "missions readable" ON public.loyalty_missions;
CREATE POLICY "missions readable" ON public.loyalty_missions FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.user_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.loyalty_missions(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id)
);
GRANT SELECT ON public.user_missions TO authenticated;
GRANT ALL ON public.user_missions TO service_role;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own missions" ON public.user_missions;
CREATE POLICY "own missions" ON public.user_missions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 5. Histórico de pontos --------------------------------------
CREATE TABLE IF NOT EXISTS public.points_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 0,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_history TO authenticated;
GRANT ALL ON public.points_history TO service_role;
ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own points history" ON public.points_history;
CREATE POLICY "own points history" ON public.points_history FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 6. Metas da comunidade --------------------------------------
CREATE TABLE IF NOT EXISTS public.community_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_members integer NOT NULL,
  current_members integer NOT NULL DEFAULT 0,
  reward_description text,
  benefit_description text,
  is_active boolean NOT NULL DEFAULT true,
  achieved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_goals TO authenticated, anon;
GRANT ALL ON public.community_goals TO service_role;
ALTER TABLE public.community_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "goals readable" ON public.community_goals;
CREATE POLICY "goals readable" ON public.community_goals FOR SELECT USING (true);

-- 7. Configuração VIP -----------------------------------------
CREATE TABLE IF NOT EXISTS public.vip_configs (
  tier public.vip_tier PRIMARY KEY,
  min_loyalty_points integer NOT NULL DEFAULT 0,
  min_months_active integer NOT NULL DEFAULT 0,
  min_conversions integer NOT NULL DEFAULT 0,
  min_reputation integer NOT NULL DEFAULT 0,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  weight_loyalty double precision NOT NULL DEFAULT 1,
  weight_referral double precision NOT NULL DEFAULT 1,
  weight_reputation double precision NOT NULL DEFAULT 1
);
GRANT SELECT ON public.vip_configs TO authenticated;
GRANT ALL ON public.vip_configs TO service_role;
ALTER TABLE public.vip_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vip config readable" ON public.vip_configs;
CREATE POLICY "vip config readable" ON public.vip_configs FOR SELECT TO authenticated USING (true);

-- 8. Funções ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_vip_tier(_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_paid int := 0; v_lifetime int := 0; v_conv int := 0; v_tier text := 'none';
BEGIN
  SELECT count(*) INTO v_paid FROM public.licenses
   WHERE user_id = _user_id AND is_trial = false AND revoked = false AND disabled_at IS NULL;
  SELECT count(*) INTO v_lifetime FROM public.licenses
   WHERE user_id = _user_id AND is_trial = false AND revoked = false
     AND disabled_at IS NULL AND expires_at IS NULL;
  SELECT COALESCE(conversions_count, 0) INTO v_conv FROM public.profiles WHERE id = _user_id;
  IF v_lifetime > 0 AND v_conv >= 10 THEN v_tier := 'elite';
  ELSIF v_lifetime > 0 THEN v_tier := 'diamond';
  ELSIF v_paid >= 3 OR v_conv >= 5 THEN v_tier := 'gold';
  ELSIF v_paid >= 2 OR v_conv >= 2 THEN v_tier := 'silver';
  ELSIF v_paid >= 1 THEN v_tier := 'bronze';
  ELSE v_tier := 'none';
  END IF;
  UPDATE public.profiles SET vip_tier = v_tier::public.vip_tier
   WHERE id = _user_id AND COALESCE(vip_tier::text,'none') IS DISTINCT FROM v_tier;
  RETURN v_tier;
END; $fn$;

CREATE OR REPLACE FUNCTION public.notify_pgrst_reload()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $fn$
  NOTIFY pgrst, 'reload schema';
$fn$;

CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  GRANT SELECT ON public.tutorials TO anon, authenticated;
  GRANT SELECT ON public.tutorial_progress TO authenticated;
  NOTIFY pgrst, 'reload schema';
END; $fn$;

CREATE OR REPLACE FUNCTION public.complete_loyalty_mission(_mission_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE _user_id uuid := auth.uid(); v_mission record; v_done int;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'message', 'Usuário não autenticado.'); END IF;
  SELECT * INTO v_mission FROM public.loyalty_missions WHERE id = _mission_id AND status = 'active';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'message', 'Missão não encontrada ou inativa.'); END IF;
  SELECT count(*) INTO v_done FROM public.user_missions
   WHERE user_id = _user_id AND mission_id = _mission_id AND completed_at IS NOT NULL;
  IF v_done >= COALESCE(v_mission.limit_count, 1) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Limite da missão atingido.');
  END IF;
  INSERT INTO public.user_missions (user_id, mission_id, progress, completed_at)
  VALUES (_user_id, _mission_id, 100, now())
  ON CONFLICT (user_id, mission_id) DO UPDATE SET progress = 100, completed_at = now();
  INSERT INTO public.points_history (user_id, amount, reason, metadata)
  VALUES (_user_id, v_mission.reward_points, 'Recompensa: ' || v_mission.title,
          jsonb_build_object('mission_id', _mission_id, 'type', 'mission_complete'));
  UPDATE public.profiles SET reward_points = COALESCE(reward_points, 0) + v_mission.reward_points
   WHERE id = _user_id;
  RETURN jsonb_build_object('ok', true, 'points_earned', v_mission.reward_points);
END; $fn$;

-- 9. Seeds -----------------------------------------------------
INSERT INTO public.loyalty_tier_config (tier, name, min_points, min_days_active, priority)
VALUES ('starter','Starter',0,0,0), ('member','Member',100,7,1), ('bronze','Bronze',300,14,2),
       ('silver','Silver',800,30,3), ('gold','Gold',1500,60,4), ('vip','VIP',3000,90,5),
       ('elite','Elite',6000,180,6)
ON CONFLICT (tier) DO NOTHING;

INSERT INTO public.community_goals (target_members, reward_description, benefit_description)
SELECT * FROM (VALUES
  (1000,'Sorteio de 5 licenças mensais','Comunidade em expansão'),
  (2500,'Desconto coletivo de 10%','Descontos liberados para todos'),
  (5000,'Bypass Play Protect grátis por 3 dias','Benefício coletivo'),
  (10000,'Evento exclusivo Shadow','Acesso antecipado a novidades')
) AS v(t,r,b)
WHERE NOT EXISTS (SELECT 1 FROM public.community_goals g WHERE g.target_members = v.t);

INSERT INTO public.loyalty_missions (title, description, difficulty, reward_points, requirements, limit_count, status)
SELECT v.title, v.description, v.difficulty, v.reward_points, v.requirements::jsonb, 1, 'active'
FROM (VALUES
  ('Identidade Shadow','Complete seu perfil com foto e apelido.','easy',50,'{"type":"profile_setup"}'),
  ('Primeiro Contato','Gere seu primeiro teste grátis.','easy',75,'{"type":"trial_generation","count":1}'),
  ('Recrutador','Traga 1 indicação válida.','medium',150,'{"type":"referral","count":1}'),
  ('Aprendiz Tático','Conclua 1 treinamento.','easy',80,'{"type":"tutorial_completion","count":1}'),
  ('Embaixador VIP','Traga 5 indicações válidas para a comunidade Shadow.','hard',500,'{"type":"referral","count":5,"min_vip_tier":"bronze"}'),
  ('Arsenal Completo','Possua 3 licenças ativas compradas.','hard',400,'{"type":"purchase","count":3,"min_vip_tier":"silver"}'),
  ('Voz do Nexus','Participe da comunidade com 20 transmissões no Shadow Nexus.','medium',250,'{"type":"community_message","count":20,"min_vip_tier":"bronze"}'),
  ('Mestre Tático','Conclua 5 treinamentos no Centro de Treinamento.','medium',300,'{"type":"tutorial_completion","count":5,"min_vip_tier":"bronze"}')
) AS v(title, description, difficulty, reward_points, requirements)
WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_missions m WHERE m.title = v.title);

INSERT INTO public.vip_configs (tier, min_loyalty_points, min_months_active, min_conversions, min_reputation)
VALUES ('bronze',0,0,0,0), ('silver',300,1,2,80), ('gold',800,2,5,85),
       ('diamond',1500,3,8,90), ('elite',3000,6,10,95)
ON CONFLICT (tier) DO NOTHING;

NOTIFY pgrst, 'reload schema';
