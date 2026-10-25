BEGIN;
DO $$
DECLARE owner_id uuid; order_id_value uuid; i int; blocked boolean := false;
BEGIN
 IF has_table_privilege('anon','public.purchase_evidence','SELECT') THEN RAISE EXCEPTION 'Anonymous receipt access'; END IF;
 IF has_table_privilege('authenticated','public.purchase_evidence','INSERT') THEN RAISE EXCEPTION 'Direct client receipt writes'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='purchase_evidence') <> 2 THEN RAISE EXCEPTION 'Missing private access policies'; END IF;
 SELECT id,user_id INTO order_id_value,owner_id FROM public.orders WHERE NOT EXISTS (SELECT 1 FROM public.purchase_evidence e WHERE e.order_id=orders.id AND e.source='customer') LIMIT 1;
 IF order_id_value IS NOT NULL THEN
  FOR i IN 1..5 LOOP
   INSERT INTO public.purchase_evidence(user_id,order_id,source,sha256) VALUES(owner_id,order_id_value,'customer','security-test-'||i);
  END LOOP;
  BEGIN
   INSERT INTO public.purchase_evidence(user_id,order_id,source,sha256) VALUES(owner_id,order_id_value,'customer','security-test-6');
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Sixth receipt was not blocked'; END IF;
  blocked := false;
  BEGIN
   INSERT INTO public.purchase_evidence(user_id,order_id,source) VALUES(gen_random_uuid(),order_id_value,'customer');
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Cross-user order was not blocked'; END IF;
 END IF;
END $$;
ROLLBACK;