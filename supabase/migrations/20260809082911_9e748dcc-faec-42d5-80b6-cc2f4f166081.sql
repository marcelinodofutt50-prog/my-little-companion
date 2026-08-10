CREATE OR REPLACE FUNCTION public.complete_loyalty_mission(_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _user_id uuid := auth.uid();
    v_mission record;
    v_already_completed int;
BEGIN
    -- 1. Lock mission
    SELECT * FROM loyalty_missions WHERE id = _mission_id AND active = TRUE INTO v_mission;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'message', 'Missão não encontrada ou inativa.');
    END IF;

    IF _user_id IS NULL THEN
        RETURN jsonb_build_object('ok', FALSE, 'message', 'Usuário não autenticado.');
    END IF;

    -- 2. Check limits
    SELECT COUNT(*) FROM loyalty_history 
    WHERE user_id = _user_id AND reference_id = _mission_id AND action_type = 'mission_complete' 
    INTO v_already_completed;

    IF v_already_completed >= v_mission.limit_per_user THEN
        RETURN jsonb_build_object('ok', FALSE, 'message', 'Limite da missão atingido.');
    END IF;

    -- 3. Grant points
    INSERT INTO loyalty_history (user_id, action_type, amount, description, reference_id)
    VALUES (_user_id, 'mission_complete', v_mission.reward_points, v_mission.title, _mission_id);

    UPDATE user_loyalty 
    SET points = points + v_mission.reward_points,
        last_action_at = now()
    WHERE user_id = _user_id;

    RETURN jsonb_build_object('ok', TRUE, 'points_earned', v_mission.reward_points);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_loyalty_mission TO authenticated;