-- Reverte restrição de leitura da comunidade: o chat/metas são recursos para todos os membros logados.
DROP POLICY IF EXISTS "community_messages_read_members" ON public.community_messages;
CREATE POLICY "community_messages_read_authenticated" ON public.community_messages
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "goals_read_members" ON public.community_goals;
CREATE POLICY "goals_read_authenticated" ON public.community_goals
  FOR SELECT TO authenticated USING (true);