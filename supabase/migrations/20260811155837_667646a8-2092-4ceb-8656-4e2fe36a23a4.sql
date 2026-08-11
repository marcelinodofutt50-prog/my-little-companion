-- 1. Community goals seed
INSERT INTO public.community_goals (target_members, reward_description, benefit_description, is_active)
SELECT * FROM (VALUES
  (1000, 'Shadow Nexus 2.0', 'Chat global com salas temáticas', true),
  (2500, 'VIP Giveaway', '50 licenças vitalícias sorteadas', true),
  (5000, 'Satellite Uplink', 'Nó de bypass dedicado global', true),
  (10000, 'Shadow Marketplace', 'Loja de recompensas exclusiva', true)
) AS v(target_members, reward_description, benefit_description, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.community_goals);

-- 2. user_missions policies (only UPDATE existed)
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own mission progress" ON public.user_missions;
CREATE POLICY "Users can view their own mission progress" ON public.user_missions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can start their own missions" ON public.user_missions;
CREATE POLICY "Users can start their own missions" ON public.user_missions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE ON public.user_missions TO authenticated;
GRANT ALL ON public.user_missions TO service_role;
GRANT SELECT ON public.loyalty_missions TO authenticated;
GRANT ALL ON public.loyalty_missions TO service_role;
GRANT SELECT ON public.community_goals TO authenticated, anon;
GRANT ALL ON public.community_goals TO service_role;

-- 3. VIP tier auto-calculation
CREATE OR REPLACE FUNCTION public.recalc_vip_tier(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid_licenses int := 0;
  v_lifetime int := 0;
  v_conversions int := 0;
  v_tier text := 'none';
BEGIN
  SELECT count(*) FILTER (WHERE is_trial = false AND revoked = false AND disabled_at IS NULL),
         count(*) FILTER (WHERE is_trial = false AND revoked = false AND disabled_at IS NULL AND expires_at IS NULL)
    INTO v_paid_licenses, v_lifetime
    FROM public.licenses WHERE user_id = _user_id;

  SELECT COALESCE(conversions_count, 0) INTO v_conversions
    FROM public.profiles WHERE id = _user_id;

  IF v_conversions >= 25 OR v_paid_licenses >= 5 THEN v_tier := 'elite';
  ELSIF v_conversions >= 10 OR v_lifetime >= 1 THEN v_tier := 'diamond';
  ELSIF v_conversions >= 5 OR v_paid_licenses >= 2 THEN v_tier := 'gold';
  ELSIF v_conversions >= 2 OR v_paid_licenses >= 1 THEN v_tier := 'silver';
  ELSIF v_conversions >= 1 THEN v_tier := 'bronze';
  END IF;

  UPDATE public.profiles
     SET vip_tier = v_tier::public.vip_tier
   WHERE id = _user_id AND COALESCE(vip_tier::text, 'none') IS DISTINCT FROM v_tier;

  RETURN v_tier;
END;
$$;

-- 4. Avatar storage policies (idempotent, owner-folder scoped)
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars owner insert" ON storage.objects;
CREATE POLICY "avatars owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "avatars owner update" ON storage.objects;
CREATE POLICY "avatars owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "avatars owner delete" ON storage.objects;
CREATE POLICY "avatars owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Community messages: allow deleting own message
DROP POLICY IF EXISTS "Users can delete their own community messages" ON public.community_messages;
CREATE POLICY "Users can delete their own community messages" ON public.community_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT SELECT, INSERT, DELETE ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

NOTIFY pgrst, 'reload schema';