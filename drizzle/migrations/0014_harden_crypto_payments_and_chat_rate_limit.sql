-- 1. Crypto payments: clients may only create fresh, unverified pending rows.
-- Verification fields, status, order link and amounts are server-only from now on.
DROP POLICY IF EXISTS "crypto_payments insert own" ON public.crypto_payments;
CREATE POLICY "crypto_payments insert own pending only"
ON public.crypto_payments
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND confirmations = 0
  AND order_id IS NULL
  AND amount_brl IS NULL
  AND amount_crypto IS NULL
  AND amount_brl_verified IS NULL
  AND fx_rate_brl IS NULL
  AND last_checked_at IS NULL
  AND verified_at IS NULL
  AND fulfilled_at IS NULL
  AND failure_reason IS NULL
  AND admin_note IS NULL
);

-- 2. Atomic community rate limit: advisory lock + count + insert in one transaction,
-- so simultaneous requests cannot all pass the 5-per-minute check.
CREATE OR REPLACE FUNCTION public.community_send_guarded(_content text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _recent int;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text, 4242));
  SELECT count(*) INTO _recent
    FROM public.community_messages
   WHERE user_id = _uid
     AND created_at > now() - interval '60 seconds';
  IF _recent >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  INSERT INTO public.community_messages (user_id, content)
  VALUES (_uid, _content)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.community_send_guarded(text) TO authenticated;