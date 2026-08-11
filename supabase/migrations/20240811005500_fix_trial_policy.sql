-- Shadow Protocol v24.0: Business Logic Correction (Trial 1D)
-- Target: Production (dvnksmqbpbzwgwmbnjjy)

-- 1. Ensure generic trial columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;

-- Grant permissions
GRANT UPDATE(trial_started_at, trial_expires_at) ON public.profiles TO authenticated;
GRANT SELECT(trial_started_at, trial_expires_at) ON public.profiles TO authenticated;

-- 2. Secure function to validate trial server-side
CREATE OR REPLACE FUNCTION public.check_trial_validity(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _expires TIMESTAMPTZ;
BEGIN
    SELECT trial_expires_at INTO _expires FROM public.profiles WHERE id = _user_id;
    
    IF _expires IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check against server time (NOW())
    RETURN _expires > NOW();
END;
$$;

-- 3. Trial usage logs
CREATE TABLE IF NOT EXISTS public.trial_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB
);

GRANT SELECT, INSERT ON public.trial_usage_logs TO authenticated;
GRANT ALL ON public.trial_usage_logs TO service_role;

ALTER TABLE public.trial_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own trial logs" ON public.trial_usage_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
