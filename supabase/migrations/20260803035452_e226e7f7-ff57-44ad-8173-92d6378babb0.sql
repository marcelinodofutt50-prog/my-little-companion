UPDATE public.plans SET active = false
WHERE slug IN ('cloak_bypass','server-monthly','upgrade-457-to-46','login-7d','login-30d','login-lifetime');

UPDATE public.plans SET sort_order = 10 WHERE slug = 'trial';
UPDATE public.plans SET sort_order = 20 WHERE slug = 'monthly_457';
UPDATE public.plans SET sort_order = 30 WHERE slug = 'lifetime_46';
UPDATE public.plans SET sort_order = 40 WHERE slug = 'upgrade_v46';
UPDATE public.plans SET sort_order = 50 WHERE slug = 'play-protect-bypass';
UPDATE public.plans SET sort_order = 60 WHERE slug = 'server_renovation';