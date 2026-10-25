CREATE TABLE public.purchase_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
 source text NOT NULL CHECK (source IN ('customer','support','mercadopago')),
 payer_name text,
 provider_payment_id text UNIQUE,
 payment_status text,
 amount numeric,
 currency text,
 approved_at timestamptz,
 storage_path text,
 storage_bucket text,
 filename text,
 mime_type text,
 sha256 text,
 source_message_id uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (order_id, sha256)
);
GRANT SELECT ON public.purchase_evidence TO authenticated;
GRANT ALL ON public.purchase_evidence TO service_role;
ALTER TABLE public.purchase_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_owner ON public.purchase_evidence FOR SELECT TO authenticated USING (auth.uid() = user_id AND public.mfa_satisfied());
CREATE POLICY evidence_admin ON public.purchase_evidence FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND public.mfa_satisfied());
CREATE INDEX evidence_payer_search ON public.purchase_evidence (lower(payer_name));
CREATE INDEX evidence_order ON public.purchase_evidence (order_id, created_at DESC);
CREATE FUNCTION public.limit_purchase_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.source = 'customer' THEN
  PERFORM 1 FROM public.orders WHERE id = NEW.order_id AND user_id = NEW.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido inválido'; END IF;
  IF (SELECT count(*) FROM public.purchase_evidence WHERE order_id = NEW.order_id AND source = 'customer') >= 5 THEN RAISE EXCEPTION 'Limite de 5 comprovantes por pedido'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER evidence_limit BEFORE INSERT ON public.purchase_evidence FOR EACH ROW EXECUTE FUNCTION public.limit_purchase_evidence();
CREATE FUNCTION public.index_support_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE linked_order uuid;
BEGIN
 IF NEW.attachment_url IS NOT NULL AND NOT coalesce(NEW.is_admin,false) AND NOT coalesce(NEW.is_system,false) THEN
  SELECT source_order_id INTO linked_order FROM public.support_threads WHERE id = NEW.thread_id AND user_id = NEW.sender_id;
  INSERT INTO public.purchase_evidence(user_id, order_id, source, source_message_id) VALUES (NEW.sender_id, linked_order, 'support', NEW.id) ON CONFLICT (source_message_id) DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.index_support_evidence() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER support_evidence_index AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.index_support_evidence();
INSERT INTO public.purchase_evidence(user_id, order_id, source, source_message_id, created_at) SELECT m.sender_id, t.source_order_id, 'support', m.id, m.created_at FROM public.support_messages m JOIN public.support_threads t ON t.id = m.thread_id AND t.user_id = m.sender_id WHERE m.attachment_url IS NOT NULL AND NOT coalesce(m.is_admin,false) AND NOT coalesce(m.is_system,false) ON CONFLICT (source_message_id) DO NOTHING;
NOTIFY pgrst, 'reload schema';