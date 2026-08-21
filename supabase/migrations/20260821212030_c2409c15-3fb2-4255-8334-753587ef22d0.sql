CREATE TABLE public.redeem_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('license_days','server_renewal')),
  days integer,
  plan_slug text,
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.redeem_code_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.redeem_codes(id) ON DELETE CASCADE,
  code text NOT NULL,
  user_id uuid NOT NULL,
  license_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_redeem_code_uses_code ON public.redeem_code_uses(code_id);
CREATE INDEX idx_redeem_code_uses_user ON public.redeem_code_uses(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.redeem_codes TO authenticated;
GRANT ALL ON public.redeem_codes TO service_role;
GRANT SELECT, INSERT ON public.redeem_code_uses TO authenticated;
GRANT ALL ON public.redeem_code_uses TO service_role;

ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_code_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_redeem_codes" ON public.redeem_codes
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff_read_redeem_uses" ON public.redeem_code_uses
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "user_read_own_redeem_uses" ON public.redeem_code_uses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_redeem_codes_updated
  BEFORE UPDATE ON public.redeem_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();