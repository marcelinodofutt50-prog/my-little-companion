
CREATE OR REPLACE FUNCTION public.recalc_vip_tier(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
  UPDATE public.profiles
     SET vip_tier = v_tier::public.vip_tier
   WHERE id = _user_id AND COALESCE(vip_tier::text, 'none') IS DISTINCT FROM v_tier;
  RETURN v_tier;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.recalc_vip_tier(uuid) TO authenticated, service_role;

-- ============ COMMUNITY GOALS ============
ALTER TABLE public.community_goals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.community_goals TO authenticated;
GRANT ALL ON public.community_goals TO service_role;

DROP POLICY IF EXISTS "goals_read_authenticated" ON public.community_goals;
CREATE POLICY "goals_read_authenticated" ON public.community_goals
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.community_goals (target_members, reward_description, benefit_description, is_active)
SELECT * FROM (VALUES
  (1000, '+100 pontos para todos', 'Marca inicial: 1.000 operadores ativos', true),
  (2500, 'Play Protect 3 dias grátis', '2.500 operadores no ecossistema', true),
  (5000, 'Desconto global de 10%', '5.000 operadores conectados', true),
  (10000, 'Recompensa exclusiva ELITE', '10.000 operadores confirmados', true)
) AS v(target_members, reward_description, benefit_description, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.community_goals);

-- ============ USER MISSIONS RLS ============
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.user_missions TO authenticated;
GRANT ALL ON public.user_missions TO service_role;

DROP POLICY IF EXISTS "user_missions_own_read" ON public.user_missions;
CREATE POLICY "user_missions_own_read" ON public.user_missions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_missions_own_insert" ON public.user_missions;
CREATE POLICY "user_missions_own_insert" ON public.user_missions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_missions_own_update" ON public.user_missions;
CREATE POLICY "user_missions_own_update" ON public.user_missions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ COMMUNITY MESSAGES: DELETE OWN ============
DROP POLICY IF EXISTS "community_messages_delete_own" ON public.community_messages;
CREATE POLICY "community_messages_delete_own" ON public.community_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ STORAGE: AVATARS POLICIES ============
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
