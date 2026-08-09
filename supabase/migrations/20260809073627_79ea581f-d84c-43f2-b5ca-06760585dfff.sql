
-- ============ 1. EVOLUÇÃO DO SCHEMA DE LICENÇAS ============

-- Criação de Enum para estados claros de licença (item 2 do plano)
DO $$ BEGIN
    CREATE TYPE public.license_status AS ENUM ('trial', 'active', 'expiring_soon', 'expired', 'cancelled', 'revoked', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Evolução da tabela de licenças (item 3)
-- Adiciona colunas para melhor controle de expiração e origem
ALTER TABLE public.licenses 
ADD COLUMN IF NOT EXISTS status public.license_status DEFAULT 'active',
ADD COLUMN IF NOT EXISTS origin_type TEXT DEFAULT 'purchase', -- 'purchase', 'trial', 'gift', 'migration'
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS trial_duration_hours INTEGER DEFAULT 24;

-- Criação de tabela de histórico de licenças (item 7)
CREATE TABLE IF NOT EXISTS public.license_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'created', 'activated', 'renewed', 'plan_changed', 'expired', 'cancelled', 'revoked', 'admin_change'
    status_from public.license_status,
    status_to public.license_status,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.license_history TO authenticated;
GRANT ALL ON public.license_history TO service_role;
ALTER TABLE public.license_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own license history" ON public.license_history FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ 2. SISTEMA DE PROMOÇÕES (SHADOW PROMOS) ============

-- Tipos de desconto (item 11)
DO $$ BEGIN
    CREATE TYPE public.promo_discount_type AS ENUM ('percentage', 'fixed_amount');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tipos de promoção
DO $$ BEGIN
    CREATE TYPE public.promo_type AS ENUM ('automatic', 'coupon', 'community_goal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de Campanhas de Promoção (item 11)
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    banner_url TEXT,
    code TEXT UNIQUE, -- Se for cupom
    discount_value NUMERIC NOT NULL,
    discount_type public.promo_discount_type NOT NULL DEFAULT 'percentage',
    promo_type public.promo_type NOT NULL DEFAULT 'automatic',
    eligible_plans TEXT[], -- Array de slugs de planos
    start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_at TIMESTAMPTZ,
    max_uses INTEGER,
    uses_count INTEGER DEFAULT 0,
    limit_per_user INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    
    -- Campos para Meta da Comunidade (item 12)
    goal_target_value INTEGER, -- Ex: 200 membros
    goal_current_value INTEGER DEFAULT 0,
    goal_reached_at TIMESTAMPTZ,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promotions TO anon, authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Promotions readable" ON public.promotions FOR SELECT TO anon, authenticated USING (active = true);

-- Tabela de utilização de cupons/promoções (item 14)
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id),
    discount_applied NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(promo_id, user_id) -- Se limit_per_user for 1
);

GRANT SELECT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own redemptions" ON public.promo_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ 3. FUNÇÕES DE SUPORTE E SEGURANÇA ============

-- Função para calcular status de licença baseado em tempo (item 2)
CREATE OR REPLACE FUNCTION public.calculate_license_status(_license_id UUID)
RETURNS public.license_status
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    lic RECORD;
    now_ts TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO lic FROM public.licenses WHERE id = _license_id;
    
    IF lic.revoked THEN RETURN 'revoked'; END IF;
    IF lic.suspended_at IS NOT NULL THEN RETURN 'suspended'; END IF;
    IF lic.disabled_at IS NOT NULL THEN RETURN 'cancelled'; END IF;
    
    IF lic.expires_at IS NULL THEN RETURN 'active'; END IF; -- Vitalício
    IF lic.expires_at < now_ts THEN RETURN 'expired'; END IF;
    
    -- Expira em menos de 3 dias?
    IF lic.expires_at < (now_ts + interval '3 days') THEN RETURN 'expiring_soon'; END IF;
    
    IF lic.is_trial THEN RETURN 'trial'; END IF;
    
    RETURN 'active';
END;
$$;

-- Trigger para registrar histórico automaticamente (item 7)
CREATE OR REPLACE FUNCTION public.log_license_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.revoked IS DISTINCT FROM NEW.revoked) THEN
        INSERT INTO public.license_history (license_id, user_id, action, status_from, status_to, details)
        VALUES (
            NEW.id, 
            NEW.user_id, 
            CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'status_change' END,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
            NEW.status,
            jsonb_build_object('by', 'system', 'revoked', NEW.revoked)
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_license_status ON public.licenses;
CREATE TRIGGER trg_log_license_status
AFTER INSERT OR UPDATE ON public.licenses
FOR EACH ROW EXECUTE FUNCTION public.log_license_status_change();

-- ============ 4. DADOS INICIAIS (ITEM 12) ============
-- Exemplo de meta da comunidade
INSERT INTO public.promotions (name, description, promo_type, goal_target_value, goal_current_value, discount_value, eligible_plans)
VALUES (
    'Meta de 200 Membros', 
    'Ao atingir 200 membros ativos, desbloqueamos 5% OFF no Vitalício!', 
    'community_goal', 
    200, 
    173, 
    5, 
    ARRAY['login-lifetime']
) ON CONFLICT DO NOTHING;
