CREATE TABLE IF NOT EXISTS public._e2e_pp_log (step text primary key, result text, detail text, at timestamptz default now());
GRANT ALL ON public._e2e_pp_log TO service_role;
ALTER TABLE public._e2e_pp_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  u uuid;
  lic uuid := gen_random_uuid();
  job uuid := gen_random_uuid();
  g record;
  ok boolean;
  n int;
BEGIN
  DELETE FROM public._e2e_pp_log;
  SELECT id INTO u FROM public.profiles ORDER BY created_at LIMIT 1;

  INSERT INTO public.licenses (id,user_id,plan_slug,yaarsa_username,yaarsa_email,yaarsa_password_enc,server_ip,panel,is_trial,revoked)
  VALUES (lic,u,'monthly_457','e2e_test_pp','e2e@test.local','x','0.0.0.0','v457',false,false);
  SELECT * INTO g FROM public.play_protect_grants WHERE license_id = lic;
  INSERT INTO public._e2e_pp_log VALUES ('1_ativacao_compra',
    CASE WHEN g.id IS NOT NULL AND g.expires_at > now() + interval '6 days' AND g.expires_at < now() + interval '8 days' THEN 'PASS' ELSE 'FAIL' END,
    coalesce(g.expires_at::text,'sem grant'));

  BEGIN
    INSERT INTO public.play_protect_grants (user_id,license_id,source,expires_at) VALUES (u,lic,'dup',now()+interval '7 days');
    INSERT INTO public._e2e_pp_log VALUES ('2_idempotencia','FAIL','duplicata aceita');
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public._e2e_pp_log VALUES ('2_idempotencia','PASS','unique license_id bloqueou duplicata');
  END;

  SELECT EXISTS(SELECT 1 FROM public.play_protect_grants gg WHERE gg.user_id=u AND gg.expires_at>now()) INTO ok;
  INSERT INTO public._e2e_pp_log VALUES ('3_acesso_ativo', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, 'grant ativo='||ok);

  INSERT INTO public.apk_jobs (id,user_id,status,source_path,source_filename,source_size_bytes,is_free_trial,expires_at)
  VALUES (job,u,'queued', u||'/'||job||'/e2e.apk','e2e.apk',1024,true, now()+interval '24 hours');
  INSERT INTO public._e2e_pp_log VALUES ('4_envio_apk',
    (SELECT CASE WHEN status='queued' THEN 'PASS' ELSE 'FAIL' END FROM public.apk_jobs WHERE id=job), 'job enfileirado');

  UPDATE public.apk_jobs SET status='processing', started_at=now() WHERE id=job;
  UPDATE public.apk_jobs SET status='done', completed_at=now(), result_path=u||'/'||job||'/result-e2e.apk', result_filename='result-e2e.apk', result_size_bytes=2048 WHERE id=job;
  INSERT INTO public._e2e_pp_log VALUES ('5_processamento',
    (SELECT CASE WHEN status='done' AND result_path IS NOT NULL THEN 'PASS' ELSE 'FAIL' END FROM public.apk_jobs WHERE id=job), 'queued->processing->done');

  INSERT INTO public.apk_free_trials (user_id,job_id) VALUES (u,job);
  BEGIN
    INSERT INTO public.apk_free_trials (user_id,job_id) VALUES (u,gen_random_uuid());
    INSERT INTO public._e2e_pp_log VALUES ('6_bloqueio_trial','FAIL','segundo teste gratis aceito');
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public._e2e_pp_log VALUES ('6_bloqueio_trial','PASS','PK user_id impede 2o teste gratis');
  END;

  INSERT INTO public.apk_jobs (id,user_id,status,source_path,source_filename,source_size_bytes,is_free_trial,expires_at)
  VALUES (gen_random_uuid(),u,'queued', u||'/stale/e2e.apk','stale.apk',1024,false, now()-interval '1 hour');
  SELECT public.expire_stale_apk_jobs() INTO n;
  INSERT INTO public._e2e_pp_log VALUES ('7_expiracao_job', CASE WHEN n>=1 THEN 'PASS' ELSE 'FAIL' END, n||' job(s) expirado(s)');

  UPDATE public.play_protect_grants SET expires_at = now() - interval '1 minute' WHERE license_id = lic;
  SELECT EXISTS(SELECT 1 FROM public.play_protect_grants gg WHERE gg.user_id=u AND gg.expires_at>now()) INTO ok;
  INSERT INTO public._e2e_pp_log VALUES ('8_expiracao_beneficio', CASE WHEN ok THEN 'FAIL' ELSE 'PASS' END, 'acesso revogado apos 7 dias');

  INSERT INTO public._e2e_pp_log VALUES ('9_isolamento_yaarsa',
    (SELECT CASE WHEN expires_at IS NULL THEN 'PASS' ELSE 'FAIL' END FROM public.licenses WHERE id=lic),
    'licenses.expires_at intacto');

  DELETE FROM public.apk_free_trials WHERE user_id=u AND job_id IN (SELECT id FROM public.apk_jobs WHERE source_filename IN ('e2e.apk','stale.apk'));
  DELETE FROM public.apk_free_trials WHERE user_id=u AND job_id NOT IN (SELECT id FROM public.apk_jobs);
  DELETE FROM public.apk_jobs WHERE source_filename IN ('e2e.apk','stale.apk') AND user_id=u;
  DELETE FROM public.play_protect_grants WHERE license_id=lic;
  DELETE FROM public.licenses WHERE id=lic;
END $$;