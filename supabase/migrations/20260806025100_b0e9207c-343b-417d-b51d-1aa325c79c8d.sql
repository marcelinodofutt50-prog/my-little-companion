-- Criar tabela de logs de auditoria se não existir
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id),
    event TEXT NOT NULL,
    decision TEXT,
    reason TEXT,
    system TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Garantir acesso apenas para staff
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- Ativar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: usuários só veem seus próprios logs (se houver), 
-- mas staff (via has_role) vê tudo.
CREATE POLICY "Staff can view all audit logs" 
ON public.audit_logs 
FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Users can view their own audit logs" 
ON public.audit_logs 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);
