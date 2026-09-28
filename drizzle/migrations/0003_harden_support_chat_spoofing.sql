-- 1) Remove políticas de envio permissivas (somadas, deixavam qualquer um
--    mandar mensagem como outra pessoa ou em conversa alheia).
DROP POLICY IF EXISTS "Users can send messages to their threads" ON public.support_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users can send messages to own threads" ON public.support_messages;
-- Fica só "Thread msgs insert": remetente = quem está logado E (equipe OU dono da conversa).

-- 2) Identidade do remetente é sempre decidida pelo banco, nunca pelo navegador.
CREATE OR REPLACE FUNCTION public.enforce_support_msg_admin_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW; -- mensagens do sistema/IA gravadas pelo servidor
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.sender_id := OLD.sender_id;
    NEW.thread_id := OLD.thread_id;
    NEW.is_admin := OLD.is_admin;
    NEW.is_system := OLD.is_system;
    NEW.sender_name := OLD.sender_name;
    NEW.sender_role := OLD.sender_role;
    NEW.sender_avatar_url := OLD.sender_avatar_url;
    RETURN NEW;
  END IF;
  NEW.sender_id := auth.uid();
  NEW.is_system := false;
  NEW.sender_name := NULL;
  NEW.sender_role := NULL;
  NEW.sender_avatar_url := NULL;
  NEW.is_admin := public.is_staff(auth.uid()) AND COALESCE(NEW.is_admin, false);
  RETURN NEW;
END; $$;

-- 3) Dono da conversa só pode fechar/marcar como lida; o resto é da equipe.
CREATE OR REPLACE FUNCTION public.enforce_support_thread_client_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role'
     OR coalesce(current_setting('app.trusted_write', true), '') = 'on'
     OR public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.user_id := OLD.user_id;
  NEW.assigned_to := OLD.assigned_to;
  NEW.assigned_name := OLD.assigned_name;
  NEW.assigned_at := OLD.assigned_at;
  NEW.priority := OLD.priority;
  NEW.closed_by := OLD.closed_by;
  NEW.closed_by_name := OLD.closed_by_name;
  NEW.unread_by_staff := OLD.unread_by_staff;
  NEW.last_staff_message_at := OLD.last_staff_message_at;
  NEW.last_customer_message_at := OLD.last_customer_message_at;
  NEW.created_at := OLD.created_at;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('closed','open') THEN
    NEW.status := OLD.status;
  END IF;
  IF NEW.unread_by_customer > OLD.unread_by_customer THEN
    NEW.unread_by_customer := OLD.unread_by_customer;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_support_thread_client_update ON public.support_threads;
CREATE TRIGGER trg_support_thread_client_update BEFORE UPDATE ON public.support_threads
FOR EACH ROW EXECUTE FUNCTION public.enforce_support_thread_client_update();

CREATE OR REPLACE FUNCTION public.bump_support_thread_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE thread_owner uuid;
BEGIN
  SELECT user_id INTO thread_owner FROM public.support_threads WHERE id = NEW.thread_id;
  IF NEW.is_system THEN RETURN NEW; END IF;
  PERFORM set_config('app.trusted_write', 'on', true);
  IF NEW.is_admin OR NEW.sender_id <> thread_owner THEN
    UPDATE public.support_threads SET unread_by_customer = unread_by_customer + 1,
      unread_by_staff = 0, last_staff_message_at = now() WHERE id = NEW.thread_id;
  ELSE
    UPDATE public.support_threads SET unread_by_staff = unread_by_staff + 1,
      unread_by_customer = 0, last_customer_message_at = now() WHERE id = NEW.thread_id;
  END IF;
  PERFORM set_config('app.trusted_write', 'off', true);
  RETURN NEW;
END; $$;

-- 4) Teste grátis só pode ser gravado pelo servidor (com antifraude).
DROP POLICY IF EXISTS "Users can claim own trial" ON public.trials;