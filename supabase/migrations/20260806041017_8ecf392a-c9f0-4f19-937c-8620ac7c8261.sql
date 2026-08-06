INSERT INTO public.plans (slug, name, description, price_brl, days, category, active, sort_order)
VALUES 
('kraken-monthly', 'Kraken 2.0 Mensal', 'Acesso Mensal à Unidade Kraken 2.0', 20000.00, 30, 'license', true, 100),
('kraken-lifetime', 'Kraken 2.0 Vitalício', 'Acesso Vitalício à Unidade Kraken 2.0', 30000.00, NULL, 'license', true, 101)
ON CONFLICT (slug) DO UPDATE SET 
  name = EXCLUDED.name,
  price_brl = EXCLUDED.price_brl,
  active = true;
