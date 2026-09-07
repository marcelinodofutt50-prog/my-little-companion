-- Novos produtos de parceria/servidor
INSERT INTO public.plans (slug, name, description, price_brl, days, category, active, sort_order)
VALUES
  ('partner-reseller-60d',
   'Servidor de Revenda (2 meses)',
   'Alugamos um servidor exclusivo pra você vender seus próprios logins. Painel de revenda liberado na hora do pagamento, você gerencia as licenças e fica com 100% do lucro. Renovação a cada 2 meses.',
   1850, 60, 'partner', true, 10),
  ('server-deploy-basic',
   'Subimos seu Servidor',
   'Já tem um servidor mas não sabe colocar online? Nossa equipe faz a instalação completa e entrega funcionando. Serviço único.',
   230, NULL, 'partner', true, 20),
  ('server-deploy-managed',
   'Subida + Proteção + Supervisão',
   'Instalação completa, camada de proteção e nossa equipe supervisionando o servidor. Serviço inicial (a mensalidade de gestão é contratada à parte).',
   340, NULL, 'partner', true, 21),
  ('server-managed-monthly',
   'Gestão Mensal do Servidor',
   'Nossa equipe cuidando do seu servidor todo mês: monitoramento, manutenção, atualizações e suporte técnico.',
   100, 30, 'partner', true, 22)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_brl = EXCLUDED.price_brl,
  days = EXCLUDED.days,
  category = EXCLUDED.category,
  active = true,
  sort_order = EXCLUDED.sort_order;

-- Acessos de parceiro liberados após o pagamento
CREATE TABLE IF NOT EXISTS public.partner_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid,
  plan_slug text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reseller','deploy','managed')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending_setup','expired','cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  server_host text,
  server_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_entitlements_user_idx ON public.partner_entitlements(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS partner_entitlements_order_idx ON public.partner_entitlements(order_id) WHERE order_id IS NOT NULL;

GRANT SELECT ON public.partner_entitlements TO authenticated;
GRANT ALL ON public.partner_entitlements TO service_role;
ALTER TABLE public.partner_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_ent_own_select" ON public.partner_entitlements;
CREATE POLICY "partner_ent_own_select" ON public.partner_entitlements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Pedidos de instalação/gestão que a equipe acompanha
CREATE TABLE IF NOT EXISTS public.partner_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entitlement_id uuid REFERENCES public.partner_entitlements(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('reseller','deploy','managed')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  server_ip text,
  ssh_user text,
  contact text,
  notes text,
  staff_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_requests_user_idx ON public.partner_service_requests(user_id);

GRANT SELECT ON public.partner_service_requests TO authenticated;
GRANT ALL ON public.partner_service_requests TO service_role;
ALTER TABLE public.partner_service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_req_own_select" ON public.partner_service_requests;
CREATE POLICY "partner_req_own_select" ON public.partner_service_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));