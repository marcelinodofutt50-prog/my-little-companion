# Roadmap (pedido em 17 partes, ordem P0→P4)

## Pedido 24/10 — renovação, bot e retenção
- [ ] Renovação: aceitar seleção do login vinculado à conta do site e manter alternativa BTmob; entrega só conclui após confirmação no painel, com retomada segura em falha.
- [ ] Suporte: resposta direta com botão de renovação/compra e orientação sem pedir senha do Gmail.
- [ ] Encerramento automático: somente resolução confirmada, sem pagamento pendente nem nova dúvida; manter prazo existente de 5 horas.
- [ ] Testar regras e telas; divulgar recursos existentes no atendimento sem alterar o visual inicial ou inventar ofertas.

## Pedido 24/10 — login, trial e pausa
- [x] Serviço externo auth e catálogo responderam 200; banco registra 15 contas com login nas últimas 24h e 4 trials emitidos desde 24/10 00:00 UTC. Não comprova ausência de falhas para todos.
- [x] Trial possui proteção contra repetição; oferta de boas-vindas usa idade do cadastro, sem prova de pessoa nova. Preço e elegibilidade não alterados.
- [x] Pausa usa remoção confirmada; retorno recria login com senha original e validade calculada no painel do IP exibido. Oito testes passaram, sem alteração de licenças reais.
- [ ] Conferir login e pausa ponta a ponta com conta real: solicitante sem conta correspondente na autenticação gerenciada; atualizar site externo e testar uma licença autorizada antes de certificar funcionamento real.

## Pedido 24/10 — excesso de chamadas de autenticação
- [x] Removidos recarregamentos em falhas de rede e invalidações repetidas da mesma sessão, mantendo validação e 2FA; navegador confirmou zero recarregamentos após erro de rede.
- [x] Verificações simultâneas de seis consumidores do navegador deduplicadas, sem cache de identidade concluída; quatro testes passaram.
- [ ] Medir redução no site externo e conferir login com conta real: criação de sessão bloqueada por indisponibilidade do banco; atualização do site externo e registros do provedor ainda necessários, sem garantia de retirar aviso de cota passada.

## Pedido 23/10 — plano ausente na renovação
- [ ] Diagnosticar e corrigir a identificação/disponibilidade do plano de servidor sem alterar preços.
- [ ] Testar a regressão e conferir o pedido de renovação; pagamento real não será realizado.

## Pedido 22/10 — licenças do admin
- [x] Melhorar busca por IP/ID, filtros por versão/status, identificação de pausadas e acesso à ficha; limite atual de 200 registros explicitado.
- [x] Confirmar ações com identificação do cliente, impedir cliques repetidos e não exibir senhas em avisos; falhas parciais do painel mostram aviso persistente.
- [x] Oito testes passaram; calendário, confirmação e cancelamento conferidos isoladamente no navegador.
- [ ] Conferir a lista e operações com conta real: autenticação bloqueada por conexão indisponível (SUPABASE_POOLER_UNAVAILABLE). Nenhuma licença real foi alterada.

## Pedido 21/10 — ficha e contador
- [~] Ficha: erros de carregamento tratados, respostas antigas ignoradas e falhas isoladas do painel. Abertura com conta real pendente: conexão de autenticação indisponível (SUPABASE_POOLER_UNAVAILABLE).
- [x] Exibir um contador pequeno no topo para Vitalício R$ 999, com prazo fixo de 60 dias; 7 testes passaram, contador conferido no computador/celular e após recarregar.

## Pedido 12/10 — suporte, sorteios, gravações e VPS
- [x] VPS: imagens ilustrativas, indicação de uso e chamado automático transacional no Lovable Cloud; repetição verificada com rollback.
- [x] Suporte/chat: conexão clara, recuperação e rascunhos isolados por usuário/conversa.
- [x] Sorteios: aleatoriedade uniforme, erros tratados e apresentação com movimento reduzido e confirmação.
- [x] Streamer: proteção de dados dinâmicos, imagens/anexos e campos sensíveis; persistência conferida no navegador.
- [x] Testes controlados: 38 testes passaram e VPS revisada em desktop/celular sem erros.
- [ ] Site externo: aplicar a migração de atendimento VPS no banco externo e atualizar o site; a conexão externa não recebeu a migração do Lovable Cloud. Pagamento real e chat com dois usuários não foram executados.

- [x] P0 Segurança: banco real, funções públicas, IDOR (mensagens do suporte corrigido), registros sem senha
- [~] P1 Bugs: reparo reescrito com as regras reais do painel + renovação reativa conta vencida (feito). Falta: confirmar no site real após Redeploy; pedidos parando antes do Mercado Pago (ver registros após Redeploy); pausar via data passada não funciona no painel (cexpire recusa)
- [ ] P2 Confiabilidade: logs/auditoria, alertas agrupados, Central de Diagnóstico (sem segredos)
- [ ] P3 UX/UI: mensagens de erro amigáveis, painel de moderadores (busca global, visão da conta, timeline), responsividade
- [ ] P4 Novidades: Telegram +1h (robô confere participação no grupo, só teste grátis ativo, 1x por conta) — precisa do token do robô e ID do grupo

## Pedido 07/10 (madrugada)
- [x] Trials: IP certo gravado (conferido no banco)
- [x] Mercado Pago aceita R$ 999,90 (link de teste ok)
- [ ] Checkout/renovação: confirmar com cliente real após Redeploy (registros por etapa)
- [ ] Telegram: mensagem do usuário veio cortada — aguardando texto
- [ ] Novas funções cliente/admin — aguardando escolha
- [ ] Painel do cliente mais limpo — aguardando escolha
