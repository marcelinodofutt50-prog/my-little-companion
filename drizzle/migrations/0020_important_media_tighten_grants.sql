REVOKE ALL ON public.customer_important_media FROM anon;
REVOKE ALL ON public.customer_important_media FROM PUBLIC;
REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.customer_important_media FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.customer_important_media TO authenticated;
GRANT ALL ON public.customer_important_media TO service_role;