-- 1) Coupons: no longer readable by anonymous visitors.
DROP POLICY IF EXISTS "Coupons readable" ON public.coupons;
CREATE POLICY "Coupons readable" ON public.coupons
  FOR SELECT TO authenticated
  USING (active = true);

-- 2) Orders: restrict client-side INSERT so users cannot self-approve or
--    pre-credit cashback. Only the webhook (service_role) may transition
--    status to 'approved' or write mp_payment_id / paid_at / cashback_credited.
DROP POLICY IF EXISTS "Own orders insert" ON public.orders;
CREATE POLICY "Own orders insert" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND (cashback_credited IS NULL OR cashback_credited = 0)
    AND mp_payment_id IS NULL
    AND paid_at IS NULL
  );

-- Also block client-side UPDATE/DELETE on orders (defense in depth — no
-- policies exist today, but make the intent explicit for future readers).
-- (No-op statements: absence of policies already denies these operations
-- under RLS. We leave a comment here instead of creating permissive rules.)

-- 3) user_roles: only SELECT own roles is permitted (already in place).
--    Explicitly document that write operations are service_role only by
--    ensuring no accidental permissive policy exists.
--    (Nothing to drop; kept as documentation.)
