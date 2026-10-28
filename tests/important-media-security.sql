-- Read-only regression: division by zero fails if clients can bypass the admin-only bookmark rules.
SELECT 1 / CASE WHEN
  NOT has_table_privilege('anon','public.customer_important_media','SELECT')
  AND NOT has_table_privilege('authenticated','public.customer_important_media','UPDATE')
  AND has_table_privilege('authenticated','public.customer_important_media','SELECT')
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.customer_important_media'::regclass)
THEN 1 ELSE 0 END AS important_media_acl_pass;
