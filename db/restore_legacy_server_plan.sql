-- Data repair, not a schema migration. Restore the missing catalog entry only;
-- preserve any existing price or administrative activation decision.
INSERT INTO public.plans (slug, name, description, price_brl, days, category, active, sort_order)
VALUES ('server-monthly-legacy', 'Renovação Servidor — Cliente Antigo',
        'Renovação de servidor para clientes antigos elegíveis da v4.5.7.',
        250.00, 30, 'server', true, 5)
ON CONFLICT (slug) DO NOTHING;