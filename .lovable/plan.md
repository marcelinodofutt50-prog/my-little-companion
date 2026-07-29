# Plano: Aautomações de alta prioridade

## Objetivo
Reduzir chamados manuais, evitar pedidos pagos sem entrega e dar visibilidade de problemas no admin.

## Fase 1 — A automações que evitam cliente sem acesso

1. **Conciliação automática de pedidos pendentes**
   - Criar server route `/api/public/hooks/reconcile-pending`.
   - Varre pedidos `status = 'pending' && created_at > now() - interval '24 hours'`.
   - Consulta Mercado Pago via `mp_payment_id` (fallback por `preference_id`) e detecta status `approved`.
   - Chama função de entrega de licença já existente, salvando `paid_at` e ativando a licença.
   - Segurança: verifica `CRON_TRIGGER_TOKEN` no header `authorization`; sem token, 401.

2. **Alerta de pedido com pagamento falho/aprovado e não entregue**
   - Novo card no admin `AdminActiveProblems.tsx`: "Pedidos pagos sem entrega", "Pagamentos rejeitados", "Jobs travados".
   - Dados de 1 consulta agregada no servidor (`admin-problems.functions.ts`).
   - Atualiza a cada 60s via polling para o admin.

3. **Dashboard de "problemas ativos" no admin mobile/desktop**
   - Seção fixa no topo do admin, com contadores e badges de cor.
   - Cada item leva direto à ação (pedido, chat, job).

## Fase 2 — Manutenção automática

4. **Limpeza automática de jobs travados do Play Protect**
   - Reutilizar `expire_stale_apk_jobs()` já existente.
   - Cron chama `/api/public/hooks/cleanup-apk-jobs` a cada 10 minutos.

## Fase 3 — Conversão e UX

5. **Renovação em 1 clique no dashboard**
   - Card "Renovar agora" quando licença ativa expira em ≤ 7 dias.
   - Reutiliza função de checkout, criando novo pedido com o mesmo `plan_slug`.

6. **Auto-preenchimento de credenciais formatadas**
   - Botão "Copiar tudo" na licença ativa, com texto já formatado para colar no app.

## Fase 4 — Relatório

7. **Relatório diário compacto no admin**
   - Card com: faturamento 24h, novos clientes, licenças ativas, reembolsos pendentes, jobs pendentes.

## Ordem de implementação

1. Reconcile pending ( maior impacto financeiro ).
2. Admin problems + active problems dashboard.
3. Cleanup cron + renewal 1-click.
4. Daily report.

## O que será alterado

- Novos arquivos:
  - `src/routes/api/public/hooks/reconcile-pending.ts`
  - `src/routes/api/public/hooks/cleanup-apk-jobs.ts`
  - `src/lib/admin-problems.functions.ts`
  - `src/components/AdminActiveProblems.tsx`
  - `src/components/LicenseRenewCard.tsx`
  - `src/components/AdminDailyReport.tsx`
- Edições:
  - `src/routes/_authenticated/admin.tsx` para adicionar as novas seções.
  - `src/routes/_authenticated/dashboard.tsx` para card de renovação.
  - SQL via `supabase--insert` para configurar os cron jobs.

## Testes

- Criar pedido de teste `pending`, simular webhook atrasado e rodar o reconcile via cron para validar entrega.
- Verificar que jobs travados são expirados automaticamente.
- Confirmar que problemas aparecem no admin com contadores corretos.