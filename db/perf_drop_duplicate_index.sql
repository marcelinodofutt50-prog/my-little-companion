-- ============================================================================
-- Performance: índice duplicado em recovery_codes
-- ============================================================================
-- O advisor apontou dois índices IDÊNTICOS em public.recovery_codes
-- (recovery_codes_user_id_idx e recovery_codes_user_idx). Manter os dois só
-- gasta espaço e custo de escrita. Removemos um (o mais "velho" por nome),
-- mantendo o outro.
--
-- Aplicar em AMBOS os bancos (Lovable Cloud + FILES_SUPABASE / produção).
-- Seguro: ainda sobra um índice cobrindo user_id. Idempotente.
-- ============================================================================

drop index if exists public.recovery_codes_user_idx;

-- Verificação (deve sobrar só recovery_codes_user_id_idx cobrindo user_id):
--   select indexname from pg_indexes where schemaname='public' and tablename='recovery_codes';
