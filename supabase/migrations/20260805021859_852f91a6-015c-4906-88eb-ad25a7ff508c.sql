select cron.alter_job(
  (select jobid from cron.job where jobname = 'reconcile-pending-orders'),
  command := $cmd$
  SELECT net.http_post(
    url := 'https://www.shadowdashstore.com/api/public/hooks/reconcile-pending',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer 72bcdea2a1e9e6d10a3eeeef1ef059807bcf6d82edc81545'),
    body := '{}'::jsonb
  );
  $cmd$
);
select cron.alter_job(
  (select jobid from cron.job where jobname = 'cleanup-apk-jobs'),
  command := $cmd$
  SELECT net.http_post(
    url := 'https://www.shadowdashstore.com/api/public/hooks/cleanup-apk-jobs',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer 72bcdea2a1e9e6d10a3eeeef1ef059807bcf6d82edc81545'),
    body := '{}'::jsonb
  );
  $cmd$
);