
-- 1) Migration requests: impedir auto-aprovação
DROP POLICY IF EXISTS "Users update own pending migration requests" ON public.migration_requests;
CREATE POLICY "Users update own pending migration requests"
  ON public.migration_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending','cancelled'));

CREATE OR REPLACE FUNCTION public.enforce_migration_request_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.user_id := OLD.user_id;
  NEW.created_at := OLD.created_at;
  IF NEW.status NOT IN ('pending','cancelled') THEN
    RAISE EXCEPTION 'Clientes não podem alterar o status para %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_migration_request_client_update ON public.migration_requests;
CREATE TRIGGER trg_migration_request_client_update
  BEFORE UPDATE ON public.migration_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_migration_request_client_update();

-- 2) Payout requests: garantir que apenas o status muda na confirmação
DROP POLICY IF EXISTS "Own payouts confirm receipt" ON public.payout_requests;
CREATE POLICY "Own payouts confirm receipt"
  ON public.payout_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'paid')
  WITH CHECK (auth.uid() = user_id AND status = 'confirmed');
