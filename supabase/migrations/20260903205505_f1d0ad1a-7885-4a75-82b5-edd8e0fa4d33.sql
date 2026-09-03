CREATE TABLE public.security_pins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin text NOT NULL,
  rotated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  uses_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_pins TO authenticated;
GRANT ALL ON public.security_pins TO service_role;

ALTER TABLE public.security_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_pins_owner_select"
  ON public.security_pins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_security_pins_updated
  BEFORE UPDATE ON public.security_pins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.pin_reveal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_email text,
  license_id uuid,
  scope text NOT NULL DEFAULT 'license_access',
  success boolean NOT NULL DEFAULT true,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pin_reveal_logs_user ON public.pin_reveal_logs (user_id, created_at DESC);

GRANT SELECT ON public.pin_reveal_logs TO authenticated;
GRANT ALL ON public.pin_reveal_logs TO service_role;

ALTER TABLE public.pin_reveal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pin_reveal_logs_owner_select"
  ON public.pin_reveal_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "pin_reveal_logs_admin_select"
  ON public.pin_reveal_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));