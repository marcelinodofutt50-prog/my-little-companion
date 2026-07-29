GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- Recria as políticas de support_messages para garantir que usem as funções com os grants corretos
DROP POLICY IF EXISTS "Thread msgs read" ON public.support_messages;
CREATE POLICY "Thread msgs read" ON public.support_messages
FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = support_messages.thread_id AND t.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Thread msgs insert" ON public.support_messages;
CREATE POLICY "Thread msgs insert" ON public.support_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = support_messages.thread_id AND t.user_id = auth.uid())
  )
);