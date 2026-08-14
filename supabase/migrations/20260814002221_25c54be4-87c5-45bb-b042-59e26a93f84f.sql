CREATE UNIQUE INDEX IF NOT EXISTS licenses_one_trial_per_user_idx
  ON public.licenses (user_id)
  WHERE is_trial IS TRUE;

ALTER TABLE public.staff_messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS staff_messages_channel_created_idx
  ON public.staff_messages (channel, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_messages TO authenticated;
GRANT ALL ON public.staff_messages TO service_role;

ALTER TABLE public.staff_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read internal messages" ON public.staff_messages;
CREATE POLICY "Staff can read internal messages"
  ON public.staff_messages FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can create internal messages" ON public.staff_messages;
CREATE POLICY "Staff can create internal messages"
  ON public.staff_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND sender_id = auth.uid());

DROP POLICY IF EXISTS "Staff can delete own internal messages" ON public.staff_messages;
CREATE POLICY "Staff can delete own internal messages"
  ON public.staff_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';