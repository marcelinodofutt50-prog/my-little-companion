
CREATE OR REPLACE FUNCTION public.enforce_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
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

  -- indicação só pode ser definida uma vez (quando ainda está vazia)
  IF OLD.referred_by IS NOT NULL THEN
    NEW.referred_by := OLD.referred_by;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_self_update ON public.profiles;
CREATE TRIGGER trg_enforce_profile_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_self_update();

-- Saques: travar valor/chave/dono na confirmação do cliente
CREATE OR REPLACE FUNCTION public.enforce_payout_confirm_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() = OLD.user_id THEN
    NEW.user_id    := OLD.user_id;
    NEW.amount     := OLD.amount;
    NEW.pix_key    := OLD.pix_key;
    NEW.created_at := OLD.created_at;
    IF NOT (OLD.status = 'paid' AND NEW.status = 'confirmed') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Transição de status não permitida';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
