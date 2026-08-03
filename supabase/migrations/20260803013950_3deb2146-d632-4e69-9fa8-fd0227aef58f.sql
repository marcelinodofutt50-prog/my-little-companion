-- Seed plans
INSERT INTO public.plans (slug, name, description, price_brl, days, category, active, sort_order)
VALUES 
  ('trial', 'Shadow 4.5.5 (Trial)', '7 dias de acesso básico para validação.', 5.00, 7, 'license', true, 10),
  ('monthly_457', 'Shadow 4.5.7 Mensal', 'Versão 4.5.7 completa com suporte e builder automatizado.', 250.00, 30, 'license', true, 20),
  ('lifetime_46', 'Shadow 4.6 Vitalício', 'Acesso permanente à versão 4.6, atualizações grátis e suporte prioritário.', 1800.00, NULL, 'license', true, 30),
  ('server_renovation', 'Renovação de Servidor', 'Manutenção mensal da infraestrutura dedicada.', 450.00, 30, 'server', true, 40),
  ('upgrade_v46', 'Upgrade p/ Vitalício 4.6', 'Migração de 4.5.7 para a versão 4.6 Vitalícia.', 600.00, NULL, 'license', true, 50),
  ('cloak_bypass', 'Play Protect Cloak', 'Bypass de longa duração com assinatura persistente e obfuscador avançado.', 299.90, 30, 'license', true, 60)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_brl = EXCLUDED.price_brl,
  days = EXCLUDED.days,
  category = EXCLUDED.category,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order;

-- Seed a default server with corrected panel value (v46)
INSERT INTO public.panel_servers (label, base_url, admin_key_enc, panel, is_active)
SELECT 'Primário (v4.6)', 'https://shadow-painel-v46.example.com', 'Madara999@', 'v46', true
WHERE NOT EXISTS (
    SELECT 1 FROM public.panel_servers WHERE base_url = 'https://shadow-painel-v46.example.com' OR panel = 'v46'
);

-- Ensure grants are correct for all system tables
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT SELECT ON public.panel_servers TO authenticated;
GRANT ALL ON public.plans TO service_role;
GRANT ALL ON public.panel_servers TO service_role;
GRANT ALL ON public.apk_jobs TO authenticated, service_role;
GRANT ALL ON public.apk_build_jobs TO authenticated, service_role;
GRANT ALL ON public.support_messages TO authenticated, service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
