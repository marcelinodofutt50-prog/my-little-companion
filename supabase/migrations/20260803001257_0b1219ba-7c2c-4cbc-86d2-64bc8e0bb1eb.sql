-- 1. Certifica que o plano de upgrade existe com o preço correto de R$ 600
UPDATE public.plans 
SET price_brl = 600, active = true, category = 'upgrade' 
WHERE slug = 'upgrade-457-to-46';

-- 2. Cria tabela para monitoramento automático de discrepâncias de licença
CREATE TABLE IF NOT EXISTS public.license_monitoring_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id uuid REFERENCES public.licenses(id) ON DELETE CASCADE,
    issue_type text NOT NULL, -- 'expiry_mismatch', 'server_mismatch', 'orphan_license'
    details jsonb,
    resolved boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.license_monitoring_logs TO authenticated;
GRANT ALL ON public.license_monitoring_logs TO service_role;
ALTER TABLE public.license_monitoring_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage logs" ON public.license_monitoring_logs
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Função para detectar licenças que venceram mas continuam ativas no Yaarsa (ou vice-versa)
CREATE OR REPLACE FUNCTION public.check_license_consistency()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    -- Inserir logs para licenças que expiram hoje e não foram marcadas como vencidas
    INSERT INTO public.license_monitoring_logs (license_id, issue_type, details)
    SELECT id, 'expiry_soon', jsonb_build_object('expires_at', expires_at, 'email', yaarsa_email)
    FROM public.licenses
    WHERE expires_at > now() AND expires_at < (now() + interval '24 hours')
    AND revoked = false AND disabled_at IS NULL;
END;
$$;