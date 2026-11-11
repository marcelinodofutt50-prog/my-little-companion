-- Defense in depth: legacy permissive policies must not bypass these guards.
CREATE OR REPLACE FUNCTION public.is_paying_customer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_staff(_user_id)
    OR (
      EXISTS (SELECT 1 FROM public.licenses l WHERE l.user_id = _user_id
        AND l.is_trial = false AND l.revoked = false AND l.disabled_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > now()))
      AND NOT EXISTS (SELECT 1 FROM public.account_bans b
        WHERE b.user_id = _user_id AND b.revoked_at IS NULL)
    )
  );
$$;
REVOKE ALL ON FUNCTION public.is_paying_customer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_paying_customer(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS customer_chat_active_access_guard ON public.customer_chat_messages;
CREATE POLICY customer_chat_active_access_guard ON public.customer_chat_messages
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_paying_customer(auth.uid()) AND public.mfa_satisfied())
WITH CHECK (public.is_paying_customer(auth.uid()) AND public.mfa_satisfied());

-- Do not enable or move APK execution to privileged handlers. Disable client writes.
REVOKE INSERT, UPDATE, DELETE ON public.apk_jobs, public.apk_build_jobs,
  public.apk_dropper_configs FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_loyalty_mission(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_loyalty_mission(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.protect_profile_referral()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN NEW.referred_by := NULL;
  ELSE NEW.referred_by := OLD.referred_by;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_profile_referral() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_profile_referral ON public.profiles;
CREATE TRIGGER protect_profile_referral BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_referral();

-- Row restrictions are independent from old, potentially overlapping grants.
DROP POLICY IF EXISTS private_support_thread_guard ON public.support_threads;
CREATE POLICY private_support_thread_guard ON public.support_threads
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.mfa_satisfied() AND (user_id = auth.uid() OR public.is_staff(auth.uid())))
WITH CHECK (public.mfa_satisfied() AND (user_id = auth.uid() OR public.is_staff(auth.uid())));

DROP POLICY IF EXISTS private_support_message_guard ON public.support_messages;
CREATE POLICY private_support_message_guard ON public.support_messages
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.mfa_satisfied() AND (public.is_staff(auth.uid()) OR EXISTS (
  SELECT 1 FROM public.support_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()
)))
WITH CHECK (public.mfa_satisfied() AND (public.is_staff(auth.uid()) OR (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()
  )
)));

-- Private financial files must never inherit unrelated permissive bucket policies.
DROP POLICY IF EXISTS private_document_storage_guard ON storage.objects;
CREATE POLICY private_document_storage_guard ON storage.objects
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  bucket_id NOT IN ('migration-proofs','support-media','payment-receipts','crypto-proofs')
  OR (public.mfa_satisfied() AND (
    (CASE WHEN split_part(name, '/', 1) = 's2' THEN split_part(name, '/', 2)
      ELSE split_part(name, '/', 1) END) = auth.uid()::text
    OR CASE WHEN bucket_id = 'support-media' THEN public.is_staff(auth.uid())
      ELSE public.has_role(auth.uid(), 'admin') END
  ))
)
WITH CHECK (
  bucket_id NOT IN ('migration-proofs','support-media','payment-receipts','crypto-proofs')
  OR (public.mfa_satisfied() AND (
    (CASE WHEN split_part(name, '/', 1) = 's2' THEN split_part(name, '/', 2)
      ELSE split_part(name, '/', 1) END) = auth.uid()::text
    OR (bucket_id = 'support-media' AND public.is_staff(auth.uid()))
  ))
);
NOTIFY pgrst, 'reload schema';