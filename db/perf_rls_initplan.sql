-- ============================================================================
-- perf_rls_initplan.sql
-- Corrige o aviso de performance do Supabase "auth_rls_initplan" em massa.
--
-- PROBLEMA: políticas RLS que chamam auth.uid() / auth.role() / auth.jwt() /
-- auth.email() DIRETO fazem o Postgres reavaliar a função PARA CADA LINHA da
-- tabela. Em tabelas grandes (licenses, orders, support_messages...) isso é
-- caríssimo. Envolvendo a chamada num subquery — (select auth.uid()) — o
-- planner avalia UMA vez (InitPlan) e reusa o valor. Mesma semântica, muito
-- mais rápido.
--   https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- O QUE ESTE SCRIPT FAZ: varre pg_policies no schema public e, para cada
-- política com chamada "nua", reescreve USING / WITH CHECK trocando só a
-- chamada por (select auth.<fn>()), preservando o resto da expressão byte a
-- byte (has_role, is_staff, mfa_satisfied, EXISTS, etc. ficam intactos).
-- Roles, comando (SELECT/INSERT/...) e permissive/restrictive NÃO são tocados.
--
-- IDEMPOTENTE: políticas que já estão com (select auth...) são puladas, então
-- pode rodar de novo sem dobrar o embrulho.
--
-- SEGURO EM PRODUÇÃO: ALTER POLICY é mudança de metadado (quase instantânea).
-- O lock_timeout abaixo faz cada ALTER desistir em 3s em vez de ficar na fila
-- travando a tabela, caso ela esteja sob carga. Rode fora do pico se der azar.
--
-- RODAR EM AMBOS OS BANCOS: Lovable Cloud E FILES (lsnkrdprzdijinstozhv).
--
-- Base deste script: 188 políticas com chamada nua de 304 no public
-- (conferido em lsnkrdprzdijinstozhv, Postgres 17.6, 2026-11-25).
-- ============================================================================

set lock_timeout = '3s';

do $$
declare
  r record;
  new_qual text;
  new_check text;
  stmt text;
  n_changed int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      -- Nota: o Postgres faz o deparse do subquery como "( SELECT auth.uid() AS uid)"
      -- com SELECT MAIÚSCULO, então o guard de "já embrulhado" é case-insensitive
      -- (!~*). Sem isso, um rerun dobraria o embrulho.
      and (
        (qual       ~ 'auth\.(uid|role|jwt|email)\(\)'
           and qual       !~* 'select\s+auth\.(uid|role|jwt|email)\(\)')
        or (with_check ~ 'auth\.(uid|role|jwt|email)\(\)'
           and with_check !~* 'select\s+auth\.(uid|role|jwt|email)\(\)')
      )
    order by tablename, policyname
  loop
    stmt := 'ALTER POLICY ' || quote_ident(r.policyname)
         || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);

    if r.qual is not null and r.qual <> '' then
      new_qual := regexp_replace(r.qual, 'auth\.(uid|role|jwt|email)\(\)',
                                 '(select auth.\1())', 'g');
      stmt := stmt || ' USING (' || new_qual || ')';
    end if;

    if r.with_check is not null and r.with_check <> '' then
      new_check := regexp_replace(r.with_check, 'auth\.(uid|role|jwt|email)\(\)',
                                  '(select auth.\1())', 'g');
      stmt := stmt || ' WITH CHECK (' || new_check || ')';
    end if;

    execute stmt;
    n_changed := n_changed + 1;
  end loop;

  raise notice 'perf_rls_initplan: % políticas reescritas.', n_changed;
end $$;

-- Conferência pós-execução: deve voltar 0.
-- select count(*) as ainda_nuas
-- from pg_policies
-- where schemaname = 'public'
--   and (
--     (qual       ~ 'auth\.(uid|role|jwt|email)\(\)'
--        and qual       !~* 'select\s+auth\.(uid|role|jwt|email)\(\)')
--     or (with_check ~ 'auth\.(uid|role|jwt|email)\(\)'
--        and with_check !~* 'select\s+auth\.(uid|role|jwt|email)\(\)')
--   );
