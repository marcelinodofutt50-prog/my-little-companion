CREATE TABLE IF NOT EXISTS public.recovery_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recovery_codes_hash_uidx ON public.recovery_codes (code_hash);
CREATE INDEX IF NOT EXISTS recovery_codes_user_idx ON public.recovery_codes (user_id);

GRANT SELECT ON public.recovery_codes TO authenticated;
GRANT ALL ON public.recovery_codes TO service_role;

ALTER TABLE public.recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recovery_codes_select_own" ON public.recovery_codes;
CREATE POLICY "recovery_codes_select_own" ON public.recovery_codes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS security_ack_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_codes_generated_at timestamp with time zone;

NOTIFY pgrst, 'reload schema';