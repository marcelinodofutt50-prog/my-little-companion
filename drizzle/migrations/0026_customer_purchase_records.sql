CREATE TABLE public.customer_purchase_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('purchase', 'note')),
  title text CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 120),
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  amount numeric(12,2) CHECK (amount IS NULL OR (amount >= 0 AND amount <= 1000000)),
  purchased_on date,
  receipt_message_id uuid REFERENCES public.support_messages(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_purchase_records_shape CHECK (
    (kind = 'purchase' AND title IS NOT NULL)
    OR (kind = 'note' AND note IS NOT NULL AND amount IS NULL AND title IS NULL)
  )
);
CREATE INDEX customer_purchase_records_customer_idx ON public.customer_purchase_records (customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_customer_purchase_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.receipt_message_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.support_messages m
      JOIN public.support_threads t ON t.id = m.thread_id
      WHERE m.id = NEW.receipt_message_id
        AND m.attachment_url IS NOT NULL
        AND t.user_id = NEW.customer_id
    ) THEN
      RAISE EXCEPTION 'O comprovante precisa ser um anexo de uma conversa deste cliente.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_customer_purchase_receipt() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER customer_purchase_records_validate_receipt
BEFORE INSERT ON public.customer_purchase_records
FOR EACH ROW EXECUTE FUNCTION public.validate_customer_purchase_receipt();

REVOKE ALL ON public.customer_purchase_records FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.customer_purchase_records TO authenticated;
GRANT ALL ON public.customer_purchase_records TO service_role;
ALTER TABLE public.customer_purchase_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_records_admin_read ON public.customer_purchase_records FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND public.mfa_satisfied());
CREATE POLICY purchase_records_admin_insert ON public.customer_purchase_records FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.mfa_satisfied() AND created_by = auth.uid());
CREATE POLICY purchase_records_admin_delete ON public.customer_purchase_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND public.mfa_satisfied());
COMMENT ON TABLE public.customer_purchase_records IS 'Private admin-only manual purchase and note records with optional chat receipt link; never grants benefits, licenses or payment approval.';
NOTIFY pgrst, 'reload schema';