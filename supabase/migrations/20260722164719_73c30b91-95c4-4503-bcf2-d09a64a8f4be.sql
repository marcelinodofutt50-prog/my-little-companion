
ALTER TABLE public.support_threads
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_name text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_by_name text,
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_staff_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS unread_by_staff integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unread_by_customer integer NOT NULL DEFAULT 0;

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_support_threads_status_activity
  ON public.support_threads(status, last_customer_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_threads_assigned
  ON public.support_threads(assigned_to);

DROP POLICY IF EXISTS "Staff can update support threads" ON public.support_threads;
CREATE POLICY "Staff can update support threads"
  ON public.support_threads FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Staff can read all support threads" ON public.support_threads;
CREATE POLICY "Staff can read all support threads"
  ON public.support_threads FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

CREATE OR REPLACE FUNCTION public.bump_support_thread_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_owner uuid;
BEGIN
  SELECT user_id INTO thread_owner FROM public.support_threads WHERE id = NEW.thread_id;
  IF NEW.is_system THEN
    RETURN NEW;
  END IF;
  IF NEW.is_admin OR NEW.sender_id <> thread_owner THEN
    UPDATE public.support_threads
       SET unread_by_customer = unread_by_customer + 1,
           unread_by_staff = 0,
           last_staff_message_at = now()
     WHERE id = NEW.thread_id;
  ELSE
    UPDATE public.support_threads
       SET unread_by_staff = unread_by_staff + 1,
           unread_by_customer = 0,
           last_customer_message_at = now()
     WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_support_thread_activity ON public.support_messages;
CREATE TRIGGER trg_bump_support_thread_activity
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_support_thread_activity();

DROP VIEW IF EXISTS public.public_recent_sales;
CREATE VIEW public.public_recent_sales
WITH (security_invoker=on) AS
  SELECT
    o.id,
    COALESCE(NULLIF(split_part(p.full_name, ' ', 1), ''), 'Cliente') AS first_name,
    COALESCE(NULLIF(left(split_part(p.full_name, ' ', 2), 1), ''), '') AS last_initial,
    o.plan_slug,
    o.amount,
    o.created_at
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.status = 'paid'
  ORDER BY o.created_at DESC
  LIMIT 30;

GRANT SELECT ON public.public_recent_sales TO anon, authenticated;

DROP POLICY IF EXISTS "Anon can read paid orders for social proof" ON public.orders;
CREATE POLICY "Anon can read paid orders for social proof"
  ON public.orders FOR SELECT
  TO anon
  USING (status = 'paid');

DROP POLICY IF EXISTS "Anon can read profiles for social proof names" ON public.profiles;
CREATE POLICY "Anon can read profiles for social proof names"
  ON public.profiles FOR SELECT
  TO anon
  USING (true);
