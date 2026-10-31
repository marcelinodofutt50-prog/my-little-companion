REVOKE ALL ON public.customer_purchase_records FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.customer_purchase_records TO authenticated;
GRANT ALL ON public.customer_purchase_records TO service_role;
NOTIFY pgrst, 'reload schema';