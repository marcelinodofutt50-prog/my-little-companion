-- Verifica que a ficha privada de compras é exclusiva de admin (sem anon, sem UPDATE) e que o comprovante pertence ao cliente.
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.customer_purchase_records', 'SELECT') THEN RAISE EXCEPTION 'anon can read purchase records'; END IF;
  IF has_table_privilege('authenticated', 'public.customer_purchase_records', 'UPDATE') THEN RAISE EXCEPTION 'authenticated can update purchase records'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.customer_purchase_records'::regclass) THEN RAISE EXCEPTION 'RLS disabled'; END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='customer_purchase_records' AND qual NOT LIKE '%has_role%' AND with_check IS NULL) > 0 THEN RAISE EXCEPTION 'policy without admin check'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.customer_purchase_records'::regclass AND tgname='customer_purchase_records_validate_receipt') THEN RAISE EXCEPTION 'receipt trigger missing'; END IF;
END $$;
