# Melhorias no Dashboard do Cliente

Escopo restrito ao comportamento (sem mexer no layout/design travado por memória do projeto).

## Bugs / melhorias propostas

1. **Pausar/despausar licença — feedback**
   - Mensagens de erro claras quando o servidor Yaarsa recusa a operação (hoje só mostra "erro").
   - Botão desabilitado durante a chamada + spinner para evitar duplo clique.
   - Toast de sucesso com hora exata de retorno agendado.

2. **Revelar credenciais**
   - Auto-ocultar após 30s para reduzir risco de shoulder-surfing.
   - Copiar senha copia sem espaços/quebras.

3. **Banner de expiração (ExpiryAlertBanner)**
   - Corrigir caso o cliente tenha várias licenças: mostrar a mais próxima do vencimento, não a primeira.
   - Esconder banner para licenças pausadas.

4. **Notificações in-app**
   - Marcar como lida ao abrir o dropdown (hoje precisa clicar item a item).
   - Badge só conta não-lidas dos últimos 30 dias.

5. **Refresh automático**
   - Após ação de pausar/retomar/reparar, invalidar `queryClient` para atualizar sem F5.

6. **Erro resiliente**
   - Envolver seções com `ErrorBoundary` local para uma seção quebrada não derrubar o dashboard inteiro.

## Fora do escopo
- Layout, cores, tipografia (travados).
- Home e página de planos.

## Detalhes técnicos
- Alterações em: `LicensePauseControls.tsx`, `ExpiryAlertBanner.tsx`, `InAppNotifications.tsx`, `dashboard.tsx` (apenas hooks/handlers), `license.functions.ts` (mensagens de erro).
- Sem migração de banco.
