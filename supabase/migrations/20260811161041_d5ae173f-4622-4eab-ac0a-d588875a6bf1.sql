
-- 1. Corrige a RPC de conclusão de missões (schema real: status/limit_count)
CREATE OR REPLACE FUNCTION public.complete_loyalty_mission(_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  v_mission record;
  v_done int;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Usuário não autenticado.');
  END IF;

  SELECT * INTO v_mission FROM public.loyalty_missions
   WHERE id = _mission_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Missão não encontrada ou inativa.');
  END IF;

  SELECT count(*) INTO v_done FROM public.user_missions
   WHERE user_id = _user_id AND mission_id = _mission_id AND completed_at IS NOT NULL;

  IF v_done >= COALESCE(v_mission.limit_count, 1) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Limite da missão atingido.');
  END IF;

  INSERT INTO public.user_missions (user_id, mission_id, progress, completed_at)
  VALUES (_user_id, _mission_id, 100, now())
  ON CONFLICT (user_id, mission_id)
  DO UPDATE SET progress = 100, completed_at = now();

  INSERT INTO public.points_history (user_id, amount, reason, metadata)
  VALUES (_user_id, v_mission.reward_points, 'Recompensa: ' || v_mission.title,
          jsonb_build_object('mission_id', _mission_id, 'type', 'mission_complete'));

  UPDATE public.profiles
     SET reward_points = COALESCE(reward_points, 0) + v_mission.reward_points
   WHERE id = _user_id;

  RETURN jsonb_build_object('ok', true, 'points_earned', v_mission.reward_points);
END;
$function$;

-- 2. Missões exclusivas VIP
INSERT INTO public.loyalty_missions (title, description, difficulty, reward_points, requirements, limit_count, status)
SELECT v.title, v.description, v.difficulty, v.reward_points, v.requirements::jsonb, 1, 'active'
FROM (VALUES
  ('Embaixador VIP', 'Traga 5 indicações válidas para a comunidade Shadow.', 'hard', 500,
   '{"type":"referral","count":5,"min_vip_tier":"bronze"}'),
  ('Arsenal Completo', 'Possua 3 licenças ativas compradas.', 'hard', 400,
   '{"type":"purchase","count":3,"min_vip_tier":"silver"}'),
  ('Voz do Nexus', 'Participe da comunidade com 20 transmissões no Shadow Nexus.', 'medium', 250,
   '{"type":"community_message","count":20,"min_vip_tier":"bronze"}'),
  ('Mestre Tático', 'Conclua 5 treinamentos no Centro de Treinamento.', 'medium', 300,
   '{"type":"tutorial_completion","count":5,"min_vip_tier":"bronze"}')
) AS v(title, description, difficulty, reward_points, requirements)
WHERE NOT EXISTS (
  SELECT 1 FROM public.loyalty_missions m WHERE m.title = v.title
);
