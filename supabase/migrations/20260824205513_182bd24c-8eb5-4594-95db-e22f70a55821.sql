CREATE TABLE IF NOT EXISTS public.product_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'melhoria',
  message text NOT NULL,
  rating int,
  is_anonymous boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'novo',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.product_feedback TO authenticated;
GRANT ALL ON public.product_feedback TO service_role;

ALTER TABLE public.product_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_insert_self" ON public.product_feedback;
CREATE POLICY "feedback_insert_self" ON public.product_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "feedback_select_own" ON public.product_feedback;
CREATE POLICY "feedback_select_own" ON public.product_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS product_feedback_created_idx ON public.product_feedback (created_at DESC);