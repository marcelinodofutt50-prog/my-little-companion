-- Shadow Protocol v22.0: Loyalty Evolution & Staff Nexus (Revised)
-- Target: dvnksmqbpbzwgwmbnjjy

-- 1. Extend Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'support', 'user');
    ELSE
        BEGIN
            ALTER TYPE public.app_role ADD VALUE 'support';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- 2. Update Profiles for Trial Benefits
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_7d_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_7d_expires_at TIMESTAMPTZ;

-- 3. Loyalty Missions (Drop old version if exists)
DROP TABLE IF EXISTS public.loyalty_missions CASCADE;
CREATE TABLE public.loyalty_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard', 'special')),
    reward_points INTEGER NOT NULL DEFAULT 0,
    requirements JSONB DEFAULT '{}',
    limit_count INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.loyalty_missions TO authenticated;
GRANT ALL ON public.loyalty_missions TO service_role;
ALTER TABLE public.loyalty_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can see active missions"
ON public.loyalty_missions FOR SELECT
TO authenticated
USING (status = 'active');

-- 4. User Missions Tracking
CREATE TABLE IF NOT EXISTS public.user_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    mission_id UUID REFERENCES public.loyalty_missions(id) ON DELETE CASCADE NOT NULL,
    progress INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, mission_id)
);

GRANT SELECT, INSERT, UPDATE ON public.user_missions TO authenticated;
GRANT ALL ON public.user_missions TO service_role;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own missions"
ON public.user_missions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own mission progress"
ON public.user_missions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 5. Points Audit Log
CREATE TABLE IF NOT EXISTS public.points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.points_history TO authenticated;
GRANT ALL ON public.points_history TO service_role;
ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own points history"
ON public.points_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 6. Staff Messages (Internal Chat)
CREATE TABLE IF NOT EXISTS public.staff_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'general',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.staff_messages TO authenticated;
GRANT ALL ON public.staff_messages TO service_role;
ALTER TABLE public.staff_messages ENABLE ROW LEVEL SECURITY;

-- 7. Seed Initial Missions
INSERT INTO public.loyalty_missions (title, description, difficulty, reward_points, requirements)
VALUES 
('Primeiros Passos', 'Complete seu perfil e nickname.', 'easy', 50, '{"type": "profile_setup"}'),
('Recruta Shadow', 'Gere seu primeiro trial de 24h.', 'easy', 100, '{"type": "trial_generation"}'),
('Shadow Partner', 'Convide 3 amigos que se cadastrem.', 'medium', 500, '{"type": "referral", "count": 3}'),
('Elite Op', 'Complete 10 tutoriais no Centro de Treinamento.', 'hard', 1000, '{"type": "tutorial_completion", "count": 10}');

-- 8. Refresh Cache
SELECT public.force_refresh_schema_permissions();
