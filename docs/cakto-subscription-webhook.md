# Assinatura Cakto no Shadow

O checkout usa a oferta mensal de R$ 750 em https://pay.cakto.com.br/haxjxbp_1331078.
O servidor emite um callback assinado para um pedido do próprio usuário. A
aprovação vincula o ID da assinatura a esse pedido. A renovação aplica 30 dias
à licença desse pedido e registra o ID da cobrança na mesma transação. O
cancelamento mantém o período pago e bloqueia novas extensões. Reembolso e
chargeback encerram a liberação dessa assinatura e antecipam a validade no
painel Yaarsa. Um reenvio pode repetir a sincronização do painel sem somar prazo.

## Configuração em homologação

1. Aplique a migração Cakto no banco de homologação.
2. Em Integrações → Webhooks na Cakto, selecione **Plano 30 dias**, informe
   `https://<host-de-homologação>/api/public/payments/cakto` e marque
   `purchase_approved`, `subscription_renewed`, `subscription_canceled`,
   `refund` e `chargeback`.
3. No servidor de homologação, defina `CAKTO_WEBHOOK_SECRET` com o segredo
   do webhook, `CAKTO_CALLBACK_SECRET` com um segredo aleatório independente
   de pelo menos 32 caracteres, e `CAKTO_PRODUCT_ID` e `CAKTO_OFFER_ID` com
   os valores de `data.product.id` e `data.offer.id` da oferta. A Cakto usa
   IDs diferentes para produto, oferta e checkout. Mantenha os segredos no
   armazenamento de variáveis do servidor.
4. Valide a entrega assinada pelo painel da Cakto. O evento de teste usa
   dados fixos. Um 204 para outro produto valida a entrega, mas não confirma
   que o pedido, a assinatura ou a licença foram vinculados.
5. Em ambiente de teste autorizado, confirme a aprovação com `callback`,
   reenvie a aprovação, simule uma renovação com outro ID de cobrança e
   confirme cancelamento, reembolso e sincronização no Yaarsa. Confira se o
   plano interno `login-30d` está ativo com o valor esperado.
6. Defina `CAKTO_CHECKOUT_ENABLED=true` apenas no ambiente em que o fluxo
   foi validado e em que a cobrança estiver autorizada.

Nenhum redirecionamento pós-pagamento é necessário para receber o callback
no webhook. A aprovação depende do webhook assinado, da oferta configurada,
do status `paid`, da moeda BRL e do valor exato.

Referências oficiais da Cakto

- [Guia de Webhooks](https://docs.cakto.com.br/conceitos/webhooks)
- [Campo callback](https://docs.cakto.com.br/conceitos/redirect-pos-pagamento)
