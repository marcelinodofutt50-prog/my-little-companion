-- ============================================================================
-- BUG: ticket aparece como "aguardando retorno" assim que o cliente abre o chat,
-- mesmo sem nenhuma mensagem.
-- ============================================================================
-- Causa: a coluna support_threads.last_customer_message_at tinha DEFAULT now().
-- Como isAwaitingSupportResponse() considera "aguardando" quando
-- last_customer_message_at está setado e é mais novo que last_staff_message_at
-- (nulo), todo thread recém-criado já nascia "aguardando retorno".
--
-- Correto: esse campo só deve ser preenchido quando o cliente ENVIA uma mensagem
-- de verdade (o trigger bump_support_thread_activity já faz isso). Sem mensagem,
-- deve ficar NULL.
--
-- Aplicar em AMBOS os bancos (Lovable Cloud + FILES_SUPABASE / produção).
-- Idempotente.
-- ============================================================================

-- 1) Remove o default: thread novo nasce com last_customer_message_at = NULL.
alter table public.support_threads
  alter column last_customer_message_at drop default;

-- 2) Conserta os threads já existentes que ficaram "aguardando" por engano:
--    zera o campo onde NÃO há nenhuma mensagem real do cliente
--    (mensagem real = não-admin, não-sistema, enviada pelo dono do thread).
update public.support_threads t
set last_customer_message_at = null
where t.last_customer_message_at is not null
  and not exists (
    select 1
    from public.support_messages m
    where m.thread_id = t.id
      and coalesce(m.is_admin, false) = false
      and coalesce(m.is_system, false) = false
      and m.sender_id = t.user_id
  );

-- Verificação:
--   select count(*) as tickets_vazios_marcados
--   from public.support_threads t
--   where t.last_customer_message_at is not null
--     and not exists (select 1 from public.support_messages m
--       where m.thread_id=t.id and coalesce(m.is_admin,false)=false
--         and coalesce(m.is_system,false)=false and m.sender_id=t.user_id);
--   -- deve voltar 0 após rodar.
