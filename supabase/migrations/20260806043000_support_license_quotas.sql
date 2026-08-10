-- Tabela para rastrear cotas de geração de licença por atendente (moderador)
CREATE TABLE public.support_quotas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    daily_limit integer DEFAULT 5 NOT NULL,
    monthly_limit integer DEFAULT 30 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (user_id)
);

-- Tabela para registrar cada geração manual
CREATE TABLE public.license_generation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_email text NOT NULL,
    plan_slug text NOT NULL,
    license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Permissões
GRANT SELECT ON public.support_quotas TO authenticated;
GRANT ALL ON public.support_quotas TO service_role;
GRANT SELECT, INSERT ON public.license_generation_logs TO authenticated;
GRANT ALL ON public.license_generation_logs TO service_role;

-- RLS
ALTER TABLE public.support_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_generation_logs ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Admins can manage quotas" ON public.support_quotas
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own quota" ON public.support_quotas
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all generation logs" ON public.license_generation_logs
    FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view their own generation logs" ON public.license_generation_logs
    FOR SELECT TO authenticated USING (auth.uid() = staff_id);

-- Função de segurança para verificar cota
CREATE OR REPLACE FUNCTION public.check_license_quota(_staff_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _daily_limit integer;
    _monthly_limit integer;
    _daily_count integer;
    _monthly_count integer;
    _is_admin boolean;
BEGIN
    -- Admins têm cota infinita
    SELECT public.has_role(_staff_id, 'admin') INTO _is_admin;
    IF _is_admin THEN
        RETURN true;
    END IF;

    -- Pega limites do atendente (ou default se não existir)
    SELECT daily_limit, monthly_limit INTO _daily_limit, _monthly_limit
    FROM public.support_quotas
    WHERE user_id = _staff_id;

    IF NOT FOUND THEN
        _daily_limit := 5;
        _monthly_limit := 30;
    END IF;

    -- Conta gerações no dia
    SELECT count(*) INTO _daily_count
    FROM public.license_generation_logs
    WHERE staff_id = _staff_id
      AND created_at >= date_trunc('day', now());

    IF _daily_count >= _daily_limit THEN
        RETURN false;
    END IF;

    -- Conta gerações no mês
    SELECT count(*) INTO _monthly_count
    FROM public.license_generation_logs
    WHERE staff_id = _staff_id
      AND created_at >= date_trunc('month', now());

    IF _monthly_count >= _monthly_limit THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$;
