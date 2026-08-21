DROP POLICY IF EXISTS "Users update own pending migration requests" ON public.migration_requests;
CREATE POLICY "Users update own pending migration requests"
  ON public.migration_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending','cancelled'));

CREATE OR REPLACE FUNCTION public.enforce_migration_request_client_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.user_id := OLD.user_id;
  NEW.created_at := OLD.created_at;
  IF NEW.status NOT IN ('pending','cancelled') THEN
    RAISE EXCEPTION 'Clientes nao podem alterar o status para %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_migration_request_client_update ON public.migration_requests;
CREATE TRIGGER trg_migration_request_client_update
  BEFORE UPDATE ON public.migration_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_migration_request_client_update();

DROP POLICY IF EXISTS "Own payouts confirm receipt" ON public.payout_requests;
CREATE POLICY "Own payouts confirm receipt"
  ON public.payout_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'paid')
  WITH CHECK (auth.uid() = user_id AND status = 'confirmed');

-- ============================================================
-- PARTE 2 — Perfis: cliente não pode se auto-promover
-- (rodar no projeto de produção usado pela Vercel)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_profile_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role'
     OR coalesce(current_setting('app.trusted_write', true), '') = 'on'
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.id := OLD.id; NEW.email := OLD.email; NEW.email_canonical := OLD.email_canonical;
  NEW.reward_points := OLD.reward_points; NEW.total_points_earned := OLD.total_points_earned;
  NEW.current_level := OLD.current_level; NEW.trust_score := OLD.trust_score;
  NEW.reputation_score := OLD.reputation_score; NEW.vip_tier := OLD.vip_tier;
  NEW.referrals_valid_count := OLD.referrals_valid_count; NEW.conversions_count := OLD.conversions_count;
  NEW.referral_code := OLD.referral_code; NEW.legacy_status := OLD.legacy_status;
  NEW.legacy_panel_hits := OLD.legacy_panel_hits;
  NEW.trial_started_at := OLD.trial_started_at; NEW.trial_expires_at := OLD.trial_expires_at;
  NEW.trial_7d_started_at := OLD.trial_7d_started_at; NEW.trial_7d_expires_at := OLD.trial_7d_expires_at;
  NEW.signup_device_hash := OLD.signup_device_hash; NEW.created_at := OLD.created_at;
  IF OLD.referred_by IS NOT NULL THEN NEW.referred_by := OLD.referred_by; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_profile_self_update ON public.profiles;
CREATE TRIGGER trg_enforce_profile_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_self_update();

-- Rotinas oficiais precisam contornar o guard
CREATE OR REPLACE FUNCTION public.recalc_vip_tier(_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_paid int := 0; v_lifetime int := 0; v_conv int := 0; v_tier text := 'none';
BEGIN
  SELECT count(*) INTO v_paid FROM public.licenses
   WHERE user_id = _user_id AND is_trial = false AND revoked = false AND disabled_at IS NULL;
  SELECT count(*) INTO v_lifetime FROM public.licenses
   WHERE user_id = _user_id AND is_trial = false AND revoked = false AND disabled_at IS NULL AND expires_at IS NULL;
  SELECT COALESCE(conversions_count, 0) INTO v_conv FROM public.profiles WHERE id = _user_id;
  IF v_lifetime > 0 AND v_conv >= 10 THEN v_tier := 'elite';
  ELSIF v_lifetime > 0 THEN v_tier := 'diamond';
  ELSIF v_paid >= 3 OR v_conv >= 5 THEN v_tier := 'gold';
  ELSIF v_paid >= 2 OR v_conv >= 2 THEN v_tier := 'silver';
  ELSIF v_paid >= 1 THEN v_tier := 'bronze';
  ELSE v_tier := 'none'; END IF;
  PERFORM set_config('app.trusted_write', 'on', true);
  UPDATE public.profiles SET vip_tier = v_tier::public.vip_tier
   WHERE id = _user_id AND COALESCE(vip_tier::text, 'none') IS DISTINCT FROM v_tier;
  PERFORM set_config('app.trusted_write', 'off', true);
  RETURN v_tier;
END; $$;

-- Saques: valor/chave/dono travados na confirmação do cliente
CREATE OR REPLACE FUNCTION public.enforce_payout_confirm_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() = OLD.user_id THEN
    NEW.user_id := OLD.user_id; NEW.amount := OLD.amount;
    NEW.pix_key := OLD.pix_key; NEW.created_at := OLD.created_at;
    IF NOT (OLD.status = 'paid' AND NEW.status = 'confirmed') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Transicao de status nao permitida';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
