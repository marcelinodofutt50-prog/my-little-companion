CREATE TABLE IF NOT EXISTS public.customer_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'geral' CHECK (channel IN ('geral','duvidas','resultados','off')),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text,
  author_avatar text,
  is_staff boolean NOT NULL DEFAULT false,
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_chat_channel_created_idx ON public.customer_chat_messages (channel, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.customer_chat_messages TO authenticated;
GRANT ALL ON public.customer_chat_messages TO service_role;
ALTER TABLE public.customer_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_paying_customer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_staff(_user_id)
    OR (
      EXISTS (SELECT 1 FROM public.licenses l
              WHERE l.user_id = _user_id AND l.is_trial = false AND l.revoked = false)
      AND NOT EXISTS (SELECT 1 FROM public.account_bans b
                      WHERE b.user_id = _user_id AND b.revoked_at IS NULL)
    )
  );
$$;
REVOKE ALL ON FUNCTION public.is_paying_customer(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_paying_customer(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.customer_chat_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_avatar text; v_recent int;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.id := OLD.id; NEW.channel := OLD.channel; NEW.user_id := OLD.user_id;
    NEW.author_name := OLD.author_name; NEW.author_avatar := OLD.author_avatar;
    NEW.is_staff := OLD.is_staff; NEW.content := OLD.content; NEW.created_at := OLD.created_at;
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN NEW.deleted_at := now(); END IF;
    RETURN NEW;
  END IF;
  NEW.user_id := auth.uid();
  NEW.created_at := now();
  NEW.deleted_at := NULL;
  NEW.is_staff := public.is_staff(auth.uid());
  NEW.content := btrim(NEW.content);
  SELECT count(*) INTO v_recent FROM public.customer_chat_messages
   WHERE user_id = auth.uid() AND created_at > now() - interval '15 seconds';
  IF v_recent >= 5 THEN RAISE EXCEPTION 'Calma aí: espere alguns segundos antes de mandar outra mensagem.'; END IF;
  SELECT COALESCE(NULLIF(display_name,''), split_part(email,'@',1), 'Cliente'), avatar_url
    INTO v_name, v_avatar FROM public.profiles WHERE id = auth.uid();
  NEW.author_name := COALESCE(v_name, 'Cliente');
  NEW.author_avatar := v_avatar;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_customer_chat_before_write ON public.customer_chat_messages;
CREATE TRIGGER trg_customer_chat_before_write BEFORE INSERT OR UPDATE ON public.customer_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.customer_chat_before_write();

DROP POLICY IF EXISTS "Customers read customer chat" ON public.customer_chat_messages;
CREATE POLICY "Customers read customer chat" ON public.customer_chat_messages
  FOR SELECT TO authenticated USING (public.is_paying_customer(auth.uid()));
DROP POLICY IF EXISTS "Customers post in customer chat" ON public.customer_chat_messages;
CREATE POLICY "Customers post in customer chat" ON public.customer_chat_messages
  FOR INSERT TO authenticated WITH CHECK (public.is_paying_customer(auth.uid()) AND user_id = auth.uid());
DROP POLICY IF EXISTS "Authors and staff remove messages" ON public.customer_chat_messages;
CREATE POLICY "Authors and staff remove messages" ON public.customer_chat_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_chat_messages;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;