
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legacy_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS legacy_panel_hits jsonb,
  ADD COLUMN IF NOT EXISTS legacy_checked_at timestamptz;

ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS upgraded_from_license_id uuid REFERENCES public.licenses(id);

INSERT INTO public.plans (slug, name, price_brl, category, active, description)
VALUES (
  'upgrade-457-to-46',
  'Upgrade v4.5.7 → v4.6',
  600,
  'upgrade',
  true,
  'Migra sua licença antiga v4.5.7 para a versão mais recente v4.6, com atualizações gratuitas e prioridade no suporte.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_brl = EXCLUDED.price_brl,
  category = EXCLUDED.category,
  active = EXCLUDED.active,
  description = EXCLUDED.description;
