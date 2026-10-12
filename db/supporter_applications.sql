CREATE TABLE IF NOT EXISTS public.supporter_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  channel_links text NOT NULL CHECK (char_length(channel_links) BETWEEN 5 AND 600),
  plan text NOT NULL DEFAULT '' CHECK (char_length(plan) <= 600),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  staff_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.supporter_applications TO authenticated;
GRANT ALL ON public.supporter_applications TO service_role;
ALTER TABLE public.supporter_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sa_select ON public.supporter_applications;
CREATE POLICY sa_select ON public.supporter_applications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS sa_insert ON public.supporter_applications;
CREATE POLICY sa_insert ON public.supporter_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending' AND reviewed_by IS NULL);
DROP POLICY IF EXISTS sa_staff_update ON public.supporter_applications;
CREATE POLICY sa_staff_update ON public.supporter_applications FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS require_mfa_aal2 ON public.supporter_applications;
CREATE POLICY require_mfa_aal2 ON public.supporter_applications AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());
NOTIFY pgrst, 'reload schema';
