-- 1. Correct missing trial columns in profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;

-- 2. Ensure community_messages exists (missing in v37.2 audit)
CREATE TABLE IF NOT EXISTS public.community_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    nickname TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    is_anonymous BOOLEAN DEFAULT false
);

GRANT SELECT, INSERT ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Anyone can read community messages' AND polrelid = 'public.community_messages'::regclass) THEN
        CREATE POLICY "Anyone can read community messages" ON public.community_messages
        FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert their own messages' AND polrelid = 'public.community_messages'::regclass) THEN
        CREATE POLICY "Users can insert their own messages" ON public.community_messages
        FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 3. Play Protect Grants Table (Business Rule v40.0)
CREATE TABLE IF NOT EXISTS public.play_protect_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE not null,
    license_id UUID,
    granted_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ not null,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, license_id)
);

GRANT SELECT ON public.play_protect_grants TO authenticated;
GRANT ALL ON public.play_protect_grants TO service_role;

ALTER TABLE public.play_protect_grants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_active_play_protect(_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.play_protect_grants
        WHERE user_id = _user_id AND expires_at > now()
    ) OR EXISTS (
        SELECT 1 FROM public.licenses
        WHERE user_id = _user_id 
        AND status = 'active'
        AND (license_type = 'lifetime' OR (license_type = 'monthly' AND expires_at > now()))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Force schema reload to clear PostgREST cache
NOTIFY pgrst, 'reload config';
SELECT pg_notify('pgrst', 'reload schema');
