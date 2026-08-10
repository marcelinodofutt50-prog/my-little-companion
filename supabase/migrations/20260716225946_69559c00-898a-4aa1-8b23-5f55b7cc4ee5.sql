ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS panel text NOT NULL DEFAULT 'v457'
  CHECK (panel IN ('v457', 'v46'));

CREATE INDEX IF NOT EXISTS licenses_panel_idx ON public.licenses(panel);

-- Backfill existing rows based on version_tier
UPDATE public.licenses
   SET panel = 'v46'
 WHERE version_tier = 'lifetime_46'
   AND panel = 'v457';