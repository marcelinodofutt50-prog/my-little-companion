-- Resetting prices to user-specified values
UPDATE public.plans SET price_brl = 750.00 WHERE slug = 'monthly_457';
UPDATE public.plans SET price_brl = 1600.00 WHERE slug = 'lifetime_46';
UPDATE public.plans SET price_brl = 450.00 WHERE slug = 'server_renovation';
UPDATE public.plans SET price_brl = 450.00 WHERE slug = 'play-protect-monthly';
UPDATE public.plans SET price_brl = 450.00 WHERE slug = 'play-protect-bypass';
UPDATE public.plans SET price_brl = 450.00 WHERE slug = 'trial'; -- Shadow 4.5.5

-- Update descriptions to reflect the fixed renewal date
UPDATE public.plans SET description = 'Taxa fixa para manutenção de infraestrutura VPS. Vencimento todo dia 20.' WHERE slug = 'server_renovation';
