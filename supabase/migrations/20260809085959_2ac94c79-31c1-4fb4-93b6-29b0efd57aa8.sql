-- SHADOW CORE IDEMPOTENT SYNC V7.6
-- This migration ensures all required types and tables exist without failing on existing ones.

-- 1. ENUMS (Safe creation)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_status') THEN
        CREATE TYPE public.loyalty_status AS ENUM ('pending', 'available', 'used', 'expired', 'revoked');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_tier') THEN
        CREATE TYPE public.loyalty_tier AS ENUM ('starter', 'member', 'bronze', 'silver', 'gold', 'vip', 'elite');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vip_tier') THEN
        CREATE TYPE public.vip_tier AS ENUM ('none', 'vip', 'gold', 'elite');
    END IF;
END $$;

-- 2. PROFILE ALIGNMENT (Safe column addition/rename)
DO $$ 
BEGIN
    -- Check reputation_score / trust_score
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'reputation_score') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'trust_score') THEN
            ALTER TABLE public.profiles RENAME COLUMN trust_score TO reputation_score;
        ELSE
            ALTER TABLE public.profiles ADD COLUMN reputation_score INTEGER DEFAULT 100;
        END IF;
    END IF;

    -- Check total_points_earned / reward_points
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'total_points_earned') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'reward_points') THEN
            ALTER TABLE public.profiles RENAME COLUMN reward_points TO total_points_earned;
        ELSE
            ALTER TABLE public.profiles ADD COLUMN total_points_earned INTEGER DEFAULT 0;
        END IF;
    END IF;

    -- Add vip_tier if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'vip_tier') THEN
        ALTER TABLE public.profiles ADD COLUMN vip_tier public.vip_tier DEFAULT 'none';
    END IF;

    -- Add metadata if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'metadata') THEN
        ALTER TABLE public.profiles ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- 3. TABLES (Safe Creation)
CREATE TABLE IF NOT EXISTS public.loyalty_tier_config (
    id uuid primary key default gen_random_uuid(),
    tier public.loyalty_tier not null unique,
    name text not null,
    min_points int not null default 0,
    min_days_active int not null default 0,
    badge_url text,
    benefits jsonb default '[]',
    priority int not null default 0,
    created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.user_loyalty (
    user_id uuid primary key references auth.users(id) on delete cascade,
    points int not null default 0,
    current_tier public.loyalty_tier not null default 'starter',
    total_spent numeric(10,2) not null default 0,
    days_active int not null default 0,
    last_action_at timestamptz default now(),
    metadata jsonb default '{}',
    created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.tutorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tutorial_id UUID REFERENCES public.tutorials(id) ON DELETE CASCADE NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tutorial_id)
);

-- 4. RLS & GRANTS (Always safe to re-apply)
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_tier_config ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_loyalty TO authenticated;
GRANT SELECT ON public.loyalty_tier_config TO authenticated;

GRANT ALL ON public.tutorial_progress TO service_role;
GRANT ALL ON public.user_loyalty TO service_role;
GRANT ALL ON public.loyalty_tier_config TO service_role;

DROP POLICY IF EXISTS "Users can manage their own progress" ON public.tutorial_progress;
CREATE POLICY "Users can manage their own progress" ON public.tutorial_progress FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own loyalty" ON public.user_loyalty;
CREATE POLICY "Users can read own loyalty" ON public.user_loyalty FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 5. NOTIFY
NOTIFY pgrst, 'reload schema';
