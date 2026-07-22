
-- 1. Remove anon SELECT policies on profiles & orders
DROP POLICY IF EXISTS "Anon can read profiles for social proof names" ON public.profiles;
DROP POLICY IF EXISTS "Anon can read paid orders for social proof" ON public.orders;

-- Expose safe columns via the existing view (owned by postgres, bypasses RLS)
GRANT SELECT ON public.public_recent_sales TO anon, authenticated;

-- 2. Payout confirm receipt: enforce only status changes
CREATE OR REPLACE FUNCTION public.enforce_payout_confirm_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass this restriction
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Only allow the customer's own paid->confirmed transition to change the status column
  IF OLD.status = 'paid' AND NEW.status = 'confirmed' AND auth.uid() = OLD.user_id THEN
    IF NEW.user_id       IS DISTINCT FROM OLD.user_id
       OR NEW.amount     IS DISTINCT FROM OLD.amount
       OR NEW.pix_key    IS DISTINCT FROM OLD.pix_key
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only status may change when confirming receipt';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payout_confirm_receipt ON public.payout_requests;
CREATE TRIGGER trg_enforce_payout_confirm_receipt
BEFORE UPDATE ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_payout_confirm_receipt();

-- 3. Remove licenses from realtime publication (sensitive credentials)
ALTER PUBLICATION supabase_realtime DROP TABLE public.licenses;

-- 4. Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions
--    Keep has_role and has_active_play_protect callable (used by RLS/app)
REVOKE EXECUTE ON FUNCTION public.enforce_support_msg_admin_flag()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_apk_jobs()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_unpaid_server_licenses()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reactivate_server_licenses_for_user(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_support_thread_activity()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_payout_confirm_receipt()              FROM PUBLIC, anon, authenticated;

-- has_role / has_active_play_protect: keep callable by authenticated only (needed by RLS + client)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)                      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role)                      TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_play_protect(uuid)                 FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_active_play_protect(uuid)                 TO authenticated;

-- 5. Market images: keep authenticated read (public marketing asset bucket) — no change needed.
--    The finding is informational; bucket is intentionally shared marketing assets.
