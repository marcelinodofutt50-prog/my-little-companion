
-- ============ 1. SISTEMA DE INDICAÇÕES PROFISSIONAL (SHADOW COMMUNITY) ============

-- Expansão de estados para o fluxo de indicação (item 3)
DO $$ BEGIN
    CREATE TYPE public.referral_status_new AS ENUM ('clicked', 'registered', 'verified', 'trial_active', 'converted', 'rewarded', 'cancelled', 'flagged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alteração da tabela de referrals para usar o novo enum
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS status public.referral_status_new DEFAULT 'clicked';

-- Tabela de eventos de indicação para rastreamento e anti-fraude (item 16)
CREATE TABLE IF NOT EXISTS public.referral_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
    event_type public.referral_status_new NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    fingerprint TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_events TO authenticated;
GRANT ALL ON public.referral_events TO service_role;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users read own referral events" ON public.referral_events FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.referrals r WHERE r.id = referral_id AND (r.referrer_id = auth.uid() OR r.referred_id = auth.uid()))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ 2. SISTEMA DE MISSÕES E RECOMPENSAS (ITEM 12) ============

CREATE TABLE IF NOT EXISTS public.reward_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- Lucide icon name
    requirement_type TEXT NOT NULL, -- 'referral_count', 'conversion_count', 'points_accumulated', 'community_goal'
    requirement_value INTEGER NOT NULL,
    reward_type TEXT NOT NULL, -- 'points', 'coupon', 'trial_days', 'badge'
    reward_value JSONB NOT NULL, -- { amount: 10 }, { code: 'WELCOME10' }, etc.
    active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reward_missions TO anon, authenticated;
GRANT ALL ON public.reward_missions TO service_role;
ALTER TABLE public.reward_missions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Missions readable" ON public.reward_missions FOR SELECT TO anon, authenticated USING (active = true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabela de progresso do usuário em missões
CREATE TABLE IF NOT EXISTS public.user_mission_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mission_id UUID NOT NULL REFERENCES public.reward_missions(id) ON DELETE CASCADE,
    current_value INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    reward_granted BOOLEAN DEFAULT false,
    UNIQUE(user_id, mission_id)
);

GRANT SELECT ON public.user_mission_progress TO authenticated;
GRANT ALL ON public.user_mission_progress TO service_role;
ALTER TABLE public.user_mission_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users read own mission progress" ON public.user_mission_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ 3. EVOLUÇÃO DE PERFIS E ANTIFRAUDE ============

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Função para verificar auto-indicação e fraudes básicas
CREATE OR REPLACE FUNCTION public.check_referral_integrity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Impede auto-indicação
    IF NEW.referrer_id = NEW.referred_id THEN
        NEW.status := 'flagged';
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_referral_integrity ON public.referrals;
CREATE TRIGGER trg_check_referral_integrity
BEFORE INSERT ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.check_referral_integrity();

-- ============ 4. DADOS INICIAIS (MISSÕES EXEMPLO) ============

INSERT INTO public.reward_missions (name, description, icon, requirement_type, requirement_value, reward_type, reward_value)
VALUES 
('Recruta Shadow', 'Indique seu primeiro amigo para a comunidade.', 'UserPlus', 'referral_count', 1, 'points', '{"amount": 5}'),
('Operador Bronze', 'Consiga 3 indicações confirmadas.', 'Users', 'referral_count', 3, 'coupon', '{"code": "SHADOWBRONZE", "discount": 10}'),
('Estrategista Prata', 'Gere 5 conversões (compras) através do seu link.', 'TrendingUp', 'conversion_count', 5, 'points', '{"amount": 50}'),
('Lenda das Sombras', 'Alcance a marca de 25 indicações.', 'Award', 'referral_count', 25, 'badge', '{"name": "LEGEND_BADGE"}')
ON CONFLICT DO NOTHING;

-- Forçar refresh do PostgREST
SELECT public.force_refresh_schema_permissions();
