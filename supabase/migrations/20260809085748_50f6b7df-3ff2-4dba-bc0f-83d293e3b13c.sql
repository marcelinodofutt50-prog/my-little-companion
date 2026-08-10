-- SHADOW CORE REMEDIATION V7.0
-- This migration fixes the Training Hub schema cache issues and provides a robust base for Loyalty/VIP systems.

-- 1. ENUMS (Safe creation)
DO $$ BEGIN
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

-- 2. PROFILE ENHANCEMENT
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS vip_tier public.vip_tier DEFAULT 'none',
ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS total_points_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. TRAINING HUB STABILIZATION (ROOT CAUSE FIX)
-- Ensure table exists with correct structure
CREATE TABLE IF NOT EXISTS public.tutorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tutorial_id UUID REFERENCES public.tutorials(id) ON DELETE CASCADE NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tutorial_id)
);

-- Reset RLS and Permissions to force PostgREST cache alignment
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT SELECT ON public.tutorial_progress TO anon; -- For metadata inspection if needed
GRANT ALL ON public.tutorial_progress TO service_role;

DROP POLICY IF EXISTS "Users can manage their own progress" ON public.tutorial_progress;
CREATE POLICY "Users can manage their own progress" 
ON public.tutorial_progress 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. LOYALTY & VIP INFRASTRUCTURE
CREATE TABLE IF NOT EXISTS public.loyalty_tier_config (
    id uuid primary key default gen_random_uuid(),
    tier loyalty_tier not null unique,
    name text not null,
    min_points int not null default 0,
    min_days_active int not null default 0,
    badge_url text,
    benefits jsonb default '[]',
    priority int not null default 0,
    created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_missions (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    category text default 'beginner', -- 'beginner', 'loyalty', 'community', 'referral', 'vip'
    requirement_type text not null, 
    requirement_value int not null,
    reward_points int not null default 0,
    reward_metadata jsonb default '{}',
    active boolean default true,
    starts_at timestamptz,
    ends_at timestamptz,
    limit_per_user int default 1,
    created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.user_loyalty (
    user_id uuid primary key references auth.users(id) on delete cascade,
    points int not null default 0,
    current_tier loyalty_tier not null default 'starter',
    total_spent numeric(10,2) not null default 0,
    days_active int not null default 0,
    last_action_at timestamptz default now(),
    metadata jsonb default '{}',
    created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    action_type text not null, 
    amount int,
    description text,
    reference_id uuid, 
    created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.vip_configs (
    tier public.vip_tier PRIMARY KEY,
    min_loyalty_points INTEGER NOT NULL,
    min_months_active INTEGER DEFAULT 0,
    min_conversions INTEGER DEFAULT 0,
    min_reputation INTEGER DEFAULT 90,
    benefits JSONB DEFAULT '[]',
    weight_loyalty FLOAT DEFAULT 1.0,
    weight_referral FLOAT DEFAULT 1.0,
    weight_reputation FLOAT DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS public.community_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_members INTEGER NOT NULL,
    current_members INTEGER DEFAULT 0,
    reward_description TEXT NOT NULL,
    benefit_description TEXT,
    is_active BOOLEAN DEFAULT true,
    achieved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. GRANTS FOR ALL NEW TABLES
GRANT SELECT ON public.loyalty_tier_config TO authenticated;
GRANT SELECT ON public.loyalty_missions TO authenticated;
GRANT SELECT ON public.user_loyalty TO authenticated;
GRANT SELECT ON public.loyalty_history TO authenticated;
GRANT SELECT ON public.vip_configs TO authenticated;
GRANT SELECT ON public.community_goals TO authenticated;

GRANT ALL ON public.loyalty_tier_config TO service_role;
GRANT ALL ON public.loyalty_missions TO service_role;
GRANT ALL ON public.user_loyalty TO service_role;
GRANT ALL ON public.loyalty_history TO service_role;
GRANT ALL ON public.vip_configs TO service_role;
GRANT ALL ON public.community_goals TO service_role;

-- 6. INITIAL SEED (Professional Tiers)
INSERT INTO public.loyalty_tier_config (tier, name, min_points, min_days_active, priority, benefits) VALUES
('starter', 'STARTER', 0, 0, 0, '["Identidade básica Shadow"]'),
('member', 'MEMBER', 500, 7, 1, '["Shadow Points", "Notificações prioritárias"]'),
('bronze', 'BRONZE', 1000, 30, 2, '["Cupons de 3%", "Badge Bronze"]'),
('silver', 'SILVER', 2500, 90, 3, '["Cupons de 5%", "Suporte agilizado"]'),
('gold', 'GOLD', 5000, 180, 4, '["Acesso Kraken v2", "Cupons de 10%"]'),
('vip', 'VIP', 10000, 365, 5, '["Gerente de conta", "Prioridade Elite"]'),
('elite', 'ELITE', 25000, 730, 6, '["Acesso total Shadow", "Benefícios físicos"]')
ON CONFLICT (tier) DO UPDATE SET name = EXCLUDED.name, min_points = EXCLUDED.min_points, benefits = EXCLUDED.benefits;

INSERT INTO public.vip_configs (tier, min_loyalty_points, min_months_active, min_conversions, min_reputation, benefits)
VALUES 
('vip', 1000, 3, 5, 80, '["Cupom 5% OFF", "Missões Exclusivas"]'),
('gold', 5000, 6, 15, 90, '["Cupom 10% OFF", "Acesso Antecipado", "Badges Especiais"]'),
('elite', 15000, 12, 50, 95, '["Gerente de Conta", "Brindes Físicos", "Prioridade Máxima Support"]')
ON CONFLICT (tier) DO UPDATE SET benefits = EXCLUDED.benefits;

-- 7. NOTIFY PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
