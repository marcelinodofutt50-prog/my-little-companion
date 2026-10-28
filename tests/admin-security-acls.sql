-- Read-only regression: division by zero fails the check if any client can bypass the server.
SELECT 1 / CASE WHEN
  NOT has_function_privilege('authenticated', 'public.complete_loyalty_mission(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.complete_loyalty_mission(uuid)', 'EXECUTE')
  AND NOT has_table_privilege('authenticated', 'public.apk_jobs', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.apk_build_jobs', 'INSERT')
THEN 1 ELSE 0 END AS security_acl_checks_pass;
