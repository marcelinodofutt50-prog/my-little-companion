-- 1. Create VIP Tiers Enum
DO $$ BEGIN
    CREATE TYPE public.vip_tier AS ENUM ('none', 'vip', 'gold', 'elite');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add VIP and Reputation columns to profiles if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS vip_tier public.vip_tier DEFAULT 'none',
ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS total_points_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. Create Community Goals table
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

GRANT SELECT ON public.community_goals TO authenticated;
GRANT ALL ON public.community_goals TO service_role;

-- 4. Create VIP Config table
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

GRANT SELECT ON public.vip_configs TO authenticated;
GRANT ALL ON public.vip_configs TO service_role;

-- 5. Seed initial community goals
INSERT INTO public.community_goals (target_members, reward_description, benefit_description)
VALUES 
(200, '5% OFF Vitalício', '3% OFF Mensal'),
(500, 'Acesso Antecipado Kraken v2', 'Sorteio Mensal VIP'),
(1000, 'Badge Community Hero', '10% OFF em qualquer plano'),
(2500, 'Evento Presencial Shadow', 'Shadow Pass Vitalício')
ON CONFLICT DO NOTHING;

-- 6. Seed VIP configs
INSERT INTO public.vip_configs (tier, min_loyalty_points, min_months_active, min_conversions, min_reputation, benefits)
VALUES 
('vip', 1000, 3, 5, 80, '["Cupom 5% OFF", "Missões Exclusivas"]'),
('gold', 5000, 6, 15, 90, '["Cupom 10% OFF", "Acesso Antecipado", "Badges Especiais"]'),
('elite', 15000, 12, 50, 95, '["Gerente de Conta", "Brindes Físicos", "Prioridade Máxima Support"]')
ON CONFLICT DO NOTHING;

-- 7. Eligibility Function
CREATE OR REPLACE FUNCTION public.calculate_vip_eligibility(_user_id UUID)
RETURNS public.vip_tier
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    u_points INTEGER;
    u_months INTEGER;
    u_conversions INTEGER;
    u_reputation INTEGER;
    target_tier public.vip_tier := 'none';
    tier_rec RECORD;
BEGIN
    SELECT points, days_active/30 INTO u_points, u_months FROM user_loyalty WHERE user_id = _user_id;
    SELECT conversions_count, reputation_score INTO u_conversions, u_reputation FROM profiles WHERE id = _user_id;
    
    FOR tier_rec IN SELECT * FROM vip_configs ORDER BY min_loyalty_points DESC LOOP
        IF u_points >= tier_rec.min_loyalty_points 
           AND u_months >= tier_rec.min_months_active 
           AND u_conversions >= tier_rec.min_conversions 
           AND u_reputation >= tier_rec.min_reputation THEN
            RETURN tier_rec.tier;
        END IF;
    END LOOP;
    
    RETURN 'none';
END;
$$;
