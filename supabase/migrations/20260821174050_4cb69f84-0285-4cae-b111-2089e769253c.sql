
CREATE OR REPLACE FUNCTION public.enforce_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR auth.role() = 'service_role'
     OR coalesce(current_setting('app.trusted_write', true), '') = 'on'
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.id                       := OLD.id;
  NEW.email                    := OLD.email;
  NEW.email_canonical          := OLD.email_canonical;
  NEW.reward_points            := OLD.reward_points;
  NEW.total_points_earned      := OLD.total_points_earned;
  NEW.current_level            := OLD.current_level;
  NEW.trust_score              := OLD.trust_score;
  NEW.reputation_score         := OLD.reputation_score;
  NEW.vip_tier                 := OLD.vip_tier;
  NEW.referrals_valid_count    := OLD.referrals_valid_count;
  NEW.conversions_count        := OLD.conversions_count;
  NEW.referral_code            := OLD.referral_code;
  NEW.legacy_status            := OLD.legacy_status;
  NEW.legacy_panel_hits        := OLD.legacy_panel_hits;
  NEW.trial_started_at         := OLD.trial_started_at;
  NEW.trial_expires_at         := OLD.trial_expires_at;
  NEW.trial_7d_started_at      := OLD.trial_7d_started_at;
  NEW.trial_7d_expires_at      := OLD.trial_7d_expires_at;
  NEW.signup_device_hash       := OLD.signup_device_hash;
  NEW.created_at               := OLD.created_at;

  IF OLD.referred_by IS NOT NULL THEN
    NEW.referred_by := OLD.referred_by;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_loyalty_mission(_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  PERFORM set_config('app.trusted_write', 'on', true);
  UPDATE public.profiles
     SET reward_points = COALESCE(reward_points, 0) + v_mission.reward_points
   WHERE id = _user_id;
  PERFORM set_config('app.trusted_write', 'off', true);

  RETURN jsonb_build_object('ok', true, 'points_earned', v_mission.reward_points);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_vip_tier(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_paid int := 0;
  v_lifetime int := 0;
  v_conv int := 0;
  v_tier text := 'none';
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
  PERFORM set_config('app.trusted_write', 'on', true);
  UPDATE public.profiles
     SET vip_tier = v_tier::public.vip_tier
   WHERE id = _user_id AND COALESCE(vip_tier::text, 'none') IS DISTINCT FROM v_tier;
  PERFORM set_config('app.trusted_write', 'off', true);
  RETURN v_tier;
END;
$$;
