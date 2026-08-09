-- Criar tabelas para o Sistema de Indicação
CREATE TABLE IF NOT EXISTS public.referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- 'pending', 'converted', 'fraud'
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(referred_id)
);

CREATE TABLE IF NOT EXISTS public.referral_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    min_conversions INTEGER NOT NULL,
    benefits JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabelas para o Sistema de Staff
CREATE TABLE IF NOT EXISTS public.staff_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    hierarchy_level INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES public.staff_roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.staff_permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.staff_roles(id),
    status TEXT DEFAULT 'active',
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.staff_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    discord_tag TEXT,
    experience TEXT,
    area TEXT,
    availability TEXT,
    motivation TEXT,
    status TEXT DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executor_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_id UUID,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Corrigir Grants (essencial para evitar PGRST108 e erros de permissão)
GRANT SELECT, INSERT, UPDATE ON public.referral_codes TO authenticated;
GRANT SELECT ON public.referrals TO authenticated;
GRANT SELECT ON public.referral_levels TO authenticated;
GRANT SELECT, INSERT ON public.staff_applications TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Habilitar RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

-- Policies (USANDO DO NOTHING PARA SER IDEMPOTENTE)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own referral code') THEN
        CREATE POLICY "Users can view their own referral code" ON public.referral_codes FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own referrals') THEN
        CREATE POLICY "Users can view their own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view referral levels') THEN
        CREATE POLICY "Public can view referral levels" ON public.referral_levels FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own applications') THEN
        CREATE POLICY "Users can view their own applications" ON public.staff_applications FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can submit applications') THEN
        CREATE POLICY "Users can submit applications" ON public.staff_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own progress') THEN
        CREATE POLICY "Users can manage their own progress" ON public.tutorial_progress FOR ALL USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Inserir permissões e cargos padrão
INSERT INTO public.staff_permissions (name, description) VALUES 
('ticket.view', 'Visualizar tickets'),
('ticket.reply', 'Responder tickets'),
('ticket.assign', 'Atribuir tickets'),
('ticket.close', 'Fechar tickets'),
('users.view', 'Visualizar usuários'),
('users.moderate', 'Moderar usuários'),
('applications.view', 'Visualizar candidaturas'),
('applications.review', 'Analisar candidaturas'),
('audit.view', 'Visualizar logs de auditoria')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.staff_roles (name, description, hierarchy_level) VALUES 
('Trainee', 'Suporte inicial em treinamento', 1),
('Suporte', 'Membro efetivo da equipe de suporte', 2),
('Moderador', 'Moderador da comunidade e suporte', 3),
('Staff', 'Membro sênior da equipe', 4),
('Admin', 'Administrador total', 5)
ON CONFLICT (name) DO NOTHING;

-- Forçar refresh do PostgREST
SELECT public.force_refresh_schema_permissions();
