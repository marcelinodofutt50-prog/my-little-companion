DROP POLICY IF EXISTS "Own orders insert" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Own orders update" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Own orders delete" ON public.orders;
DROP POLICY IF EXISTS "Users can delete own orders" ON public.orders;

REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

UPDATE public.orders
SET status = 'cancelled',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'security_hold', true,
      'security_reason', 'amount_below_minimum',
      'security_reviewed_at', now()
    )
WHERE status IN ('pending', 'created')
  AND amount < 1;

NOTIFY pgrst, 'reload schema';