# Roadmap (pedido em 17 partes, ordem P0→P4)

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
