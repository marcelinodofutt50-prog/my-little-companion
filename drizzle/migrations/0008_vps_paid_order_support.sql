ALTER TABLE public.support_threads ADD COLUMN IF NOT EXISTS source_order_id uuid REFERENCES public.orders(id);
CREATE UNIQUE INDEX IF NOT EXISTS support_threads_source_order_unique ON public.support_threads(source_order_id) WHERE source_order_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.open_paid_vps_support() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE thread_id uuid; plan_name text;
BEGIN
  IF NEW.status <> 'paid' OR NEW.paid_at IS NULL OR NEW.plan_slug NOT IN ('vps-starter','vps-performance','vps-pro') THEN RETURN NEW; END IF;
  SELECT name INTO plan_name FROM public.plans WHERE slug = NEW.plan_slug AND category = 'market';
  IF plan_name IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.support_threads(user_id,subject,status,category,priority,source_order_id)
  VALUES (NEW.user_id, 'Entrega VPS — ' || plan_name, 'open', 'servidor', 'alta', NEW.id)
  ON CONFLICT (source_order_id) WHERE source_order_id IS NOT NULL DO NOTHING RETURNING id INTO thread_id;
  IF thread_id IS NOT NULL THEN
    INSERT INTO public.support_messages(thread_id,sender_id,is_admin,is_system,body)
    VALUES (thread_id,NEW.user_id,false,true,'Pagamento da ' || plan_name || ' confirmado. Este chamado foi aberto automaticamente para a equipe preparar seu acesso e combinar a entrega. Aguarde as orientações aqui; não envie senhas ou códigos de segurança.');
  ELSE
    SELECT id INTO thread_id FROM public.support_threads WHERE source_order_id=NEW.id;
  END IF;
  UPDATE public.orders SET metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('vps_auto_thread_id',thread_id) WHERE id=NEW.id;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.open_paid_vps_support() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_paid_vps_support() TO service_role;
CREATE OR REPLACE TRIGGER open_paid_vps_support_trigger AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.open_paid_vps_support();
NOTIFY pgrst, 'reload schema';