
ALTER TABLE public.vip_configs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.vip_configs TO authenticated;
GRANT ALL ON public.vip_configs TO service_role;
DROP POLICY IF EXISTS "vip config readable" ON public.vip_configs;
CREATE POLICY "vip config readable" ON public.vip_configs
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "vip config admin write" ON public.vip_configs;
CREATE POLICY "vip config admin write" ON public.vip_configs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.loyalty_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.loyalty_history TO authenticated;
GRANT ALL ON public.loyalty_history TO service_role;
DROP POLICY IF EXISTS "own loyalty history" ON public.loyalty_history;
CREATE POLICY "own loyalty history" ON public.loyalty_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "staff read loyalty history" ON public.loyalty_history;
CREATE POLICY "staff read loyalty history" ON public.loyalty_history
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

ALTER TABLE public.community_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
