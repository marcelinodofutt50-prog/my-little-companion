ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS plan_slug text,
  ADD COLUMN IF NOT EXISTS label text;

CREATE INDEX IF NOT EXISTS coupons_user_idx ON public.coupons(user_id) WHERE user_id IS NOT NULL;

GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;

DROP POLICY IF EXISTS "Coupons public read" ON public.coupons;
CREATE POLICY "Coupons public read" ON public.coupons FOR SELECT TO authenticated
  USING (active AND user_id IS NULL);

DROP POLICY IF EXISTS "Coupons own read" ON public.coupons;
CREATE POLICY "Coupons own read" ON public.coupons FOR SELECT TO authenticated
  USING (user_id = auth.uid());