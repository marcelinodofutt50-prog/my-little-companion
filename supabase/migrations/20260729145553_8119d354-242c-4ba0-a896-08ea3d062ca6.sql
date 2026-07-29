-- Staff = admin OR moderator
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'moderator');
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- support_messages: staff can read/write every thread
DROP POLICY IF EXISTS "Thread msgs read" ON public.support_messages;
CREATE POLICY "Thread msgs read" ON public.support_messages
FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = support_messages.thread_id AND t.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Thread msgs insert" ON public.support_messages;
CREATE POLICY "Thread msgs insert" ON public.support_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = support_messages.thread_id AND t.user_id = auth.uid())
  )
);

-- profiles / orders / licenses: read-only visibility for support
DROP POLICY IF EXISTS "Own profile read" ON public.profiles;
CREATE POLICY "Own profile read" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Own orders read" ON public.orders;
CREATE POLICY "Own orders read" ON public.orders
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Own licenses read" ON public.licenses;
CREATE POLICY "Own licenses read" ON public.licenses
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- apk_jobs: support manages the Play Protect queue
DROP POLICY IF EXISTS "admins manage apk jobs" ON public.apk_jobs;
CREATE POLICY "staff manage apk jobs" ON public.apk_jobs
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

-- staff messages must be flagged as staff, not as the customer
CREATE OR REPLACE FUNCTION public.enforce_support_msg_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF public.is_staff(auth.uid()) THEN
    NEW.is_admin := COALESCE(NEW.is_admin, false);
  ELSE
    NEW.is_admin := false;
  END IF;
  RETURN NEW;
END; $function$;