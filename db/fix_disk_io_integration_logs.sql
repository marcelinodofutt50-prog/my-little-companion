-- ============================================================================
-- FIX: Disk IO Budget esgotando — causado pela tabela public.integration_logs
-- ============================================================================
-- Diagnóstico (pg_stat_statements + tamanho):
--   * integration_logs: ~281 mil linhas / ~264 MB; 92% têm +14 dias (lixo de log).
--   * As consultas analíticas filtram por "action" e ordenam por created_at,
--     mas NÃO existe índice em action -> varredura da tabela inteira (muito disk read).
--   * Volume enorme de INSERT (o app loga quase toda ação).
--
-- Rode as seções NA ORDEM. Idealmente com o Disk IO Budget já recarregado
-- (as próprias operações usam IO — é um custo único para alívio contínuo).
-- Aplicar em AMBOS os bancos (Lovable Cloud + FILES_SUPABASE / produção).
-- ============================================================================

-- ─── 1) Índice que falta (rode SOZINHO — CONCURRENTLY não roda em transação) ──
-- Cobre "where action = ... order by created_at desc", o padrão das queries pesadas.
create index concurrently if not exists integration_logs_action_created_idx
  on public.integration_logs (action, created_at desc);


-- ─── 2) Procedure de poda em LOTES (commit por lote = sem travar / sem pico) ───
create or replace procedure public.prune_integration_logs(_days int default 30, _batch int default 10000)
language plpgsql
as $$
declare deleted int;
begin
  loop
    delete from public.integration_logs
    where ctid in (
      select ctid from public.integration_logs
      where created_at < now() - (_days || ' days')::interval
      limit _batch
    );
    get diagnostics deleted = row_count;
    commit;                      -- libera o lote antes do próximo
    exit when deleted = 0;
  end loop;
end;
$$;

-- ─── 3) Roda a poda agora (apaga logs com +30 dias, de 10 mil em 10 mil) ───────
call public.prune_integration_logs(30, 10000);

-- ─── 4) Devolve espaço e atualiza estatísticas do planejador ──────────────────
vacuum (analyze) public.integration_logs;

-- ─── 5) Retenção automática: pg_cron apaga logs antigos todo dia 05:00 UTC ─────
-- (pg_cron já está instalado neste projeto.)
select cron.schedule('prune-integration-logs', '0 5 * * *',
  $$ call public.prune_integration_logs(30, 20000); $$);

-- Verificação:
--   select count(*) as linhas, pg_size_pretty(pg_total_relation_size('public.integration_logs')) as tamanho
--   from public.integration_logs;
--   -- deve cair de ~281k para ~20k linhas.
