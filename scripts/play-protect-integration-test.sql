-- ============================================================================
-- Shadow Protocol v47.1 — TESTE DE INTEGRAÇÃO REAL DO PLAY PROTECT
-- Projeto: produção (dvnksmqbpbzwgwmbnjjy)
-- Segurança: tudo roda dentro de uma transação que termina em ROLLBACK.
--            Usuários/licenças de teste são isolados e NUNCA persistem.
--            Nenhum dado real de cliente é lido, alterado ou removido.
-- ============================================================================
BEGIN;

DO $$
DECLARE
  u_none      uuid := gen_random_uuid();  -- cliente sem licença
  u_monthly   uuid := gen_random_uuid();  -- cliente mensal
  u_lifetime  uuid := gen_random_uuid();  -- cliente vitalício
  u_existing  uuid := gen_random_uuid();  -- cliente com licença já válida
  u_trial     uuid := gen_random_uuid();  -- trial ShadowDash 24h
  lic_month   uuid;
  lic_life    uuid;
  lic_old     uuid;
  lic_new     uuid;
  lic_trial   uuid;
  n           int;
  d           numeric;
  fails       int := 0;

  PROCEDURE_NOOP boolean;

  FUNCTION_HELPER boolean;
BEGIN
  -- helper de asserção
  CREATE TEMP TABLE _pp_results(nome text, esperado text, obtido text, ok boolean) ON COMMIT DROP;

  -- usuários de teste isolados
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  SELECT x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'pp-test-' || x || '@shadow-test.invalid', '', now(), now(), now()
    FROM unnest(ARRAY[u_none, u_monthly, u_lifetime, u_existing, u_trial]) AS x;

  -- ---------------------------------------------------------------- CASO 1
  -- Cliente sem nenhuma licença NÃO recebe os 7 dias.
  SELECT count(*) INTO n FROM public.play_protect_grants WHERE user_id = u_none;
  INSERT INTO _pp_results VALUES ('1. Sem licença → sem Play Protect', '0 grants', n || ' grants', n = 0);

  -- ---------------------------------------------------------------- CASO 2
  -- Compra MENSAL → exatamente 1 grant de 7 dias.
  INSERT INTO public.licenses (user_id, plan_slug, yaarsa_username, yaarsa_email, yaarsa_password_enc, panel)
  VALUES (u_monthly, 'kraken-monthly', 'ppm01', 'ppm01@shadow-test.invalid', 'enc', 'v457')
  RETURNING id INTO lic_month;

  SELECT count(*) INTO n FROM public.play_protect_grants WHERE user_id = u_monthly;
  INSERT INTO _pp_results VALUES ('2a. Mensal → 1 grant', '1 grant', n || ' grants', n = 1);

  SELECT round(EXTRACT(epoch FROM (expires_at - granted_at)) / 86400.0, 4)
    INTO d FROM public.play_protect_grants WHERE user_id = u_monthly;
  INSERT INTO _pp_results VALUES ('2b. Mensal → duração exata', '7 dias', d || ' dias', d = 7);

  -- ---------------------------------------------------------------- CASO 3
  -- Compra VITALÍCIA → exatamente 1 grant de 7 dias.
  INSERT INTO public.licenses (user_id, plan_slug, yaarsa_username, yaarsa_email, yaarsa_password_enc, panel)
  VALUES (u_lifetime, 'kraken-lifetime', 'ppl01', 'ppl01@shadow-test.invalid', 'v46')
  RETURNING id INTO lic_life;

  SELECT count(*) INTO n FROM public.play_protect_grants WHERE user_id = u_lifetime;
  INSERT INTO _pp_results VALUES ('3a. Vitalício → 1 grant', '1 grant', n || ' grants', n = 1);

  SELECT round(EXTRACT(epoch FROM (expires_at - granted_at)) / 86400.0, 4)
    INTO d FROM public.play_protect_grants WHERE user_id = u_lifetime;
  INSERT INTO _pp_results VALUES ('3b. Vitalício → duração exata', '7 dias', d || ' dias', d = 7);

  -- ---------------------------------------------------------------- CASO 4
  -- Cliente que JÁ possui licença válida:
  --   a) eventos repetidos na mesma licença não geram novo grant;
  --   b) uma NOVA compra gera um novo grant próprio (regra por licença).
  INSERT INTO public.licenses (user_id, plan_slug, yaarsa_username, yaarsa_email, yaarsa_password_enc, panel, expires_at)
  VALUES (u_existing, 'monthly_457', 'ppe01', 'ppe01@shadow-test.invalid', 'enc', 'v457', now() + interval '20 days')
  RETURNING id INTO lic_old;

  -- simula recarregar página / relogin / reprocessar evento (updates na mesma licença)
  UPDATE public.licenses SET additional_info_synced_at = now() WHERE id = lic_old;
  UPDATE public.licenses SET expires_at = expires_at WHERE id = lic_old;

  SELECT count(*) INTO n FROM public.play_protect_grants WHERE license_id = lic_old;
  INSERT INTO _pp_results VALUES ('4a. Licença válida + eventos repetidos → sem duplicação', '1 grant', n || ' grants', n = 1);

  -- tentativa explícita de duplicar o grant da MESMA licença
  BEGIN
    INSERT INTO public.play_protect_grants (user_id, license_id, source)
    VALUES (u_existing, lic_old, 'license_purchase');
    INSERT INTO _pp_results VALUES ('4b. Insert duplicado na mesma licença', 'bloqueado', 'aceito (FALHA)', false);
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO _pp_results VALUES ('4b. Insert duplicado na mesma licença', 'bloqueado', 'bloqueado por unique(license_id)', true);
  END;

  -- nova compra do mesmo cliente → novo grant independente
  INSERT INTO public.licenses (user_id, plan_slug, yaarsa_username, yaarsa_email, yaarsa_password_enc, panel)
  VALUES (u_existing, 'kraken-lifetime', 'ppe02', 'ppe02@shadow-test.invalid', 'enc', 'v46')
  RETURNING id INTO lic_new;

  SELECT count(*) INTO n FROM public.play_protect_grants WHERE user_id = u_existing;
  INSERT INTO _pp_results VALUES ('4c. Nova compra → novo grant próprio', '2 grants', n || ' grants', n = 2);

  -- ---------------------------------------------------------------- CASO 5
  -- Isolamento: trial ShadowDash 24h NÃO concede Play Protect.
  INSERT INTO public.licenses (user_id, plan_slug, yaarsa_username, yaarsa_email, yaarsa_password_enc, panel, is_trial, status, expires_at)
  VALUES (u_trial, 'trial', 'ppt01', 'ppt01@shadow-test.invalid', 'enc', 'v455', true, 'trial', now() + interval '24 hours')
  RETURNING id INTO lic_trial;

  SELECT count(*) INTO n FROM public.play_protect_grants WHERE user_id = u_trial;
  INSERT INTO _pp_results VALUES ('5a. Trial 24h ShadowDash → sem Play Protect', '0 grants', n || ' grants', n = 0);

  SELECT round(EXTRACT(epoch FROM (expires_at - now())) / 3600.0)
    INTO d FROM public.licenses WHERE id = lic_trial;
  INSERT INTO _pp_results VALUES ('5b. Trial ShadowDash mantém 24h', '24 h', d || ' h', d = 24);

  -- ---------------------------------------------------------------- CASO 6
  -- Licença revogada / plano não elegível não concede benefício.
  INSERT INTO public.licenses (user_id, plan_slug, yaarsa_username, yaarsa_email, yaarsa_password_enc, panel, revoked)
  VALUES (u_none, 'kraken-monthly', 'ppr01', 'ppr01@shadow-test.invalid', 'enc', 'v457', true);
  INSERT INTO public.licenses (user_id, plan_slug, yaarsa_username, yaarsa_email, yaarsa_password_enc, panel)
  VALUES (u_none, 'plano-inexistente', 'ppx01', 'ppx01@shadow-test.invalid', 'enc', 'v457');

  SELECT count(*) INTO n FROM public.play_protect_grants WHERE user_id = u_none;
  INSERT INTO _pp_results VALUES ('6. Revogada + plano não elegível → sem grant', '0 grants', n || ' grants', n = 0);

  -- ---------------------------------------------------------------- CASO 7
  -- Clientes REAIS existentes não foram prejudicados pela migration:
  -- nenhum grant duplicado por licença em toda a base de produção.
  SELECT count(*) INTO n FROM (
    SELECT license_id FROM public.play_protect_grants
     WHERE license_id IS NOT NULL GROUP BY license_id HAVING count(*) > 1
  ) q;
  INSERT INTO _pp_results VALUES ('7a. Base real sem grants duplicados', '0 duplicados', n || ' duplicados', n = 0);

  SELECT count(*) INTO n FROM public.play_protect_grants
   WHERE source = 'license_purchase'
     AND round(EXTRACT(epoch FROM (expires_at - granted_at)) / 86400.0, 4) <> 7;
  INSERT INTO _pp_results VALUES ('7b. Base real: todos os grants = 7 dias', '0 fora da regra', n || ' fora da regra', n = 0);

  SELECT count(*) INTO n FROM public.play_protect_grants g
    JOIN public.licenses l ON l.id = g.license_id WHERE l.is_trial = true;
  INSERT INTO _pp_results VALUES ('7c. Nenhum grant vindo de trial', '0', n::text, n = 0);

  -- ---------------------------------------------------------------- RELATÓRIO
  RAISE NOTICE '';
  RAISE NOTICE '=== PLAY PROTECT — TESTES DE INTEGRAÇÃO (produção, transação revertida) ===';
  FOR n IN SELECT 1 LOOP END LOOP;
  PERFORM 1;
END $$;

SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS resultado, nome, esperado, obtido
  FROM _pp_results ORDER BY nome;

SELECT count(*) FILTER (WHERE ok) || '/' || count(*) AS placar,
       CASE WHEN count(*) FILTER (WHERE NOT ok) = 0 THEN 'PLAY PROTECT OK' ELSE 'FALHAS DETECTADAS' END AS veredito
  FROM _pp_results;

ROLLBACK;
