CREATE TABLE IF NOT EXISTS public.recovery_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recovery_codes_hash_uidx ON public.recovery_codes (code_hash);
CREATE INDEX IF NOT EXISTS recovery_codes_user_idx ON public.recovery_codes (user_id);

REVOKE ALL ON public.recovery_codes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_codes TO authenticated;
GRANT ALL ON public.recovery_codes TO service_role;

ALTER TABLE public.recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recovery_codes_select_own" ON public.recovery_codes;
DROP POLICY IF EXISTS "recovery_codes_read_own" ON public.recovery_codes;
DROP POLICY IF EXISTS "recovery_codes_create_own" ON public.recovery_codes;
DROP POLICY IF EXISTS "recovery_codes_delete_own" ON public.recovery_codes;
DROP POLICY IF EXISTS "recovery_codes_update_own" ON public.recovery_codes;
DROP POLICY IF EXISTS "Users can read own recovery codes" ON public.recovery_codes;
DROP POLICY IF EXISTS "Users can insert own recovery codes" ON public.recovery_codes;
DROP POLICY IF EXISTS "Users can delete own recovery codes" ON public.recovery_codes;

CREATE POLICY "recovery_codes_read_own"
ON public.recovery_codes
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "recovery_codes_create_own"
ON public.recovery_codes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recovery_codes_delete_own"
ON public.recovery_codes
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "recovery_codes_update_own"
ON public.recovery_codes
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS security_ack_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_codes_generated_at timestamp with time zone;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

NOTIFY pgrst, 'reload schema';