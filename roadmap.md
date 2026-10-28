# Roadmap (pedido em 17 partes, ordem P0→P4)

## Pedido 28/10 — mídias importantes na ficha
- [x] Destacar anexos privados na galeria (botão Marcar + filtro Importantes) e consultar/remover na ficha do cliente, sem aprovar pagamentos; só admin com 2FA.
- [x] 170 testes passaram; permissões/RLS verificadas no Cloud; compilação automática OK.
- [ ] Fluxo conectado como admin: conta do solicitante ausente no preview. Site externo: migração recusada por SELF_SIGNED_CERT_IN_CHAIN, sem desativar TLS; requer aplicação e deploy autorizado.
- [ ] Emissão de licenças não alterada por restrição de segurança contextual.

## Pedido 28/10 — Creator: recuperação automática segura
- [x] Recuperação de leituras transitórias: no máximo duas tentativas, 12 segundos cada, intervalo de 500 ms; consultas canceladas ao trocar conta, sair ou iniciar outra leitura. Gravações nunca repetidas automaticamente.
- [x] Identidade conferida com getUser e ações ocultadas durante nova leitura/falha, sem alterar regras de licença ou recompensa.
- [x] 34 testes passaram, incluindo cinco de recuperação/cancelamento; compilação automática OK às 02:47:37 UTC.
- [ ] Validar com Creator conectado: emissão de sessão própria recusada porque o solicitante não tem conta no preview; depende de entrar no preview com conta autorizada. Site externo não atualizado.

## Pedido 28/10 — Creator: isolamento de ações por conta
- [x] Respostas de ações antigas não alteram avisos, rascunhos ou bloqueios de outra conta; operações invalidadas ao trocar conta ou sair da tela, com trava síncrona contra cliques repetidos e tratamento de falhas.
- [x] 29 testes passaram, incluindo 6 de isolamento A→B→A, conta desconectada, saída da tela e concorrência; compilação automática OK e /creator encaminhou para /auth sem erros. Sem mudar regras de licença ou recompensas.
- [ ] Validar ações com Creator/equipe conectados: emissão de sessão própria recusada porque o solicitante não possui conta no preview; depende de entrada autorizada. Site externo exige deploy.

## Pedido 28/10 — estabilidade e privacidade do Creator
- [x] Área do Creator e revisão da equipe: falha de leitura mostra aviso com "Tentar novamente" em vez de "só para Creators aprovados"/"Nada aqui"; leituras antigas são ignoradas e dados são limpos ao trocar de conta.
- [x] Equipe: botões travados durante a gravação (sem cliques duplos), comentário já salvo é preservado ao aprovar/recusar de novo, contagem deixa claro que cobre os vídeos mais recentes. Creator: erro ao remover vídeo mostra o motivo real (ex.: 2FA).
- [x] 22 testes passaram (4 novos de mensagens/remoção) e compilação OK; licenças, recompensas e regras de envio não foram alteradas.
- [ ] Conferir as telas com conta Creator/equipe reais: a conta do solicitante não existe na autenticação do preview. Site externo precisa do deploy.
- [ ] Não feito (decisão de política): moderadores revisarem Creators (hoje a aba exige permissão de anúncios) e limite de links dos pedidos de apoiador.

## Pedido 28/10 — revisão profunda e melhorias defensivas do admin
- [x] Corrigir exposição de texto em notificações, imagem antiga aberta e upload atrasado ao trocar conversa; separar horários do texto nas mensagens.
- [x] Restringir retornos de pagamento a origens explícitas, esconder erros internos e usar aleatoriedade criptográfica em cortesias; sem novos produtos ou entrega de licenças.
- [x] Conter inserções diretas inseguras em filas de APK e execução pública da missão sem prova; criação de APK fica bloqueada para clientes, sem refazer esse serviço.
- [x] 503 testes passaram em 72 arquivos; compilação automática OK e ACLs verificadas no Cloud; /admin redireciona para /auth sem erros no navegador.
- [ ] Validar atendimento conectado: emissão de sessão própria indisponível (conta do solicitante ausente); depende de entrada autorizada no preview.
- [ ] Proteções do banco externo: conexão recusada por certificado não confiável; não foi desativada a validação TLS. Atualização da tela externa depende de deploy.
- [ ] Análise profunda em andamento; dependências possuem avisos de vulnerabilidade não corrigidos nesta revisão, e leitura pública de arquivos requer classificação antes de restringir.

## Pedido 28/10 — admin: carregamento, busca e chat
- [x] Corrigir respostas antigas na busca/histórico, carregamento preso após atualização silenciosa e erros de classificação; adicionar nova tentativa e proteger rascunho contra reformulação atrasada de outra conversa, sem mudar compras/licenças.
- [x] 31 testes direcionados passaram e compilação automática OK; acesso deslogado encaminha para /auth sem erros. Cloud saudável, sem saturação atual.
- [ ] Validar buscas e atendimento autenticados: conta do solicitante ausente no Cloud; exige entrada no preview com conta admin. Site externo precisa do deploy atualizado.

## Pedido 28/10 — isolamento de permissões do Creator
- [x] Restringir consulta de status a proprietário/equipe com MFA; retirar gravações diretas e migrar revisão de pedidos para RPC com responsável confirmado; aplicado no Cloud e FILES, sem alterar licenças ou recompensas.
- [x] Teste SQL com rollback passou no FILES: proprietário lê seus registros, outra conta não lê/apaga/revisa, equipe revisa com atribuição correta; permissões SELECT-only confirmadas no Cloud, 15 testes de links passaram e compilação OK.
- [ ] Conferir a tela autenticada: conta do solicitante ausente no Cloud; teste SQL com troca de papel bloqueado pela conexão gerenciada. Atualização da tela de revisão no site externo depende do deploy Vercel; análise profunda em andamento.

## Pedido 28/10 — segurança do Creator
- [x] Restringir links de vídeos armazenados nas telas do Creator e da equipe a HTTPS e plataformas permitidas, rejeitando credenciais, portas alternativas e destinos disfarçados; sem alterar licença, recompensas ou divulgação.
- [x] 15 testes de links passaram e compilação automática sem erros; fluxo autenticado do Creator não foi exercitado, e o site externo ainda exige atualização.

## Pedido 28/10 — envio de prints no chat
- [x] Atendentes voltaram a enviar prints nos chats: o pedido de upload passa a confirmar o cargo no servidor, em vez de depender de um aviso do navegador que nunca chegava para a equipe; cliente continua restrito à própria conversa.
- [x] Impressão enviada de fato em conversa de teste: arquivo guardado e mensagem registrada (imagem/png, pela conta da equipe), sem aviso de acesso negado; 22 testes de acesso a anexos passaram, incluindo 4 novos.
- [ ] Atualizar o site externo: enquanto o deploy na Vercel não for refeito sem cache, o envio de prints continua quebrado em shadowdashstore.com, que ainda roda o código antigo.

## Pedido 28/10 — chat do admin mais organizado
- [x] Faixas do atendimento agrupadas: prioridade/categoria junto de Resumo do atendimento e Mídias numa única linha de ferramentas; Corrigir bugs, Assumir e Encerrar no cabeçalho do ticket; ficha do cliente com Ficha e Copiar ficha colados.
- [x] Título do ticket e e-mail do cliente voltam a aparecer por extenso; nenhum botão solto e nenhum ícone de atualizar repetido.
- [x] Botão Assumir legível nos dois temas: cor de destaque com texto próprio definido por tema (antes usava um nome de cor inexistente e o texto ficava escuro sobre azul).
- [x] Respostas rápidas junto da caixa de mensagem; resumo do atendimento compacto com expansão opcional; 469 testes e compilação OK; conversa conferida no navegador com conta da equipe.
- [ ] Atualizar o site externo para que a organização chegue aos atendentes: o deploy na Vercel ainda não foi refeito sem cache.

## Pedido 27/10 — mídias do chat admin
- [x] Botão Mídias por conversa com histórico paginado, filtros, visualização de imagens, reprodução e abertura de arquivos; acesso pela consulta autenticada existente e isolamento ao trocar de ticket.
- [x] 24 testes de privacidade/anexos passaram; compilação automática sem erros.
- [ ] Conferir abertura da galeria com admin real: conta do solicitante não encontrada na autenticação do preview; requer entrada no preview com conta autorizada. Site externo não atualizado.

## Pedido 25/10 — comprovantes no admin, revisão geral e PIX por fora
- [x] Aba Comprovantes do admin profissionalizada: filtro por origem, e-mail do cliente, plano/valor/status do pedido vinculado e botão "Registrar pagamento" em anexos sem vínculo.
- [x] Registro de PIX feito por fora (chat do suporte): admin informa e-mail do cliente, plano e login alvo (renovação); o pedido usa o preço oficial conferido pela integridade e a entrega é a mesma de uma compra normal (licença nova ou renovação), com auditoria e histórico próprio.
- [x] Revisão de pagamento/entrega: corrigido bug real — falha ao gravar o comprovante do provedor derrubava o webhook do Mercado Pago (HTTP 400), fazendo o provedor reenviar notificações sem fim; agora o registro é melhor-esforço e nunca bloqueia a entrega.
- [x] 440 testes passaram (12 novos de registro manual), tipos sem erro, compilação OK; página pública sem erros no navegador.
- [ ] Conferir a aba Comprovantes e o registro manual com conta de admin real e atualizar o site externo: preview sem sessão do solicitante (conta não existe na autenticação do preview). Nenhum pagamento real foi registrado.

## Pedido 25/10 — anúncios e comprovantes
- [x] Retirados os dois anúncios automáticos (meta de 300 inscritos e oferta diária), sem mudar o layout do painel.
- [x] Comprovante opcional na confirmação, histórico e chat geral (envio privado); Admin → Comprovantes com busca paginada, download temporário e organização de anexos do suporte.
- [x] Anexos do suporte indexados transacionalmente, inclusive históricos, como candidatos não verificados; registros mínimos do Mercado Pago por pagamento, sem documento bancário inventado ou aprovação por anexo. Nome do chat depende da leitura da equipe, sem OCR automático.
- [x] Estrutura e bucket privado aplicados no Lovable Cloud e FILES; 21 testes passaram (7 de comprovantes + 14 regressões), testes SQL de permissões/limite/vínculo passaram com rollback; assets válidos, compilação OK e página pública sem erros.
- [ ] Envio e pesquisa ponta a ponta com conta real e atualização do site externo: solicitante não tem conta correspondente na autenticação do preview; precisa entrar no preview e atualizar o deploy externo. Nenhum comprovante falso foi gravado em compra real e nenhum pagamento foi realizado.

## Pedido 24/10 — renovação, bot e retenção
- [x] Renovação: seleção do login vinculado à conta do site e alternativa BTmob; preço validado por licença e falhas de painel não concluem entrega, entrando na retomada existente.
- [x] Suporte: resposta determinística concluída antes de retornar, botões de renovação/compra/tutoriais e orientação para não pagar duas vezes nem informar senha do Gmail.
- [x] Encerramento automático: exige última confirmação explícita do cliente, sem pagamento/entrega pendente, 5 horas e atualização da conversa inalterada.
- [x] 26 testes passaram; validação de assets e compilação sem erros; página pública de renovação conferida sem erros no navegador. Sem mudanças na homepage/dashboard ou ofertas inventadas.
- [ ] Conferir seleção da licença, resposta do bot e renovação ponta a ponta com conta real e atualizar site externo: sessão do solicitante indisponível e nenhuma compra/licença real foi alterada. Rotina externa de fechamento ainda não teve execução confirmada.

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

## Pedido 26/10 — correções da análise profunda de segurança
- [x] Crítico: travar inserção direta em crypto_payments (só linhas novas "pending", sem campos de verificação) e reverificar no agendador linhas confirmadas sem prova on-chain.
- [x] Alto: exigir 2FA no servidor para ações de admin (mfa_satisfied em assertAdminRole).
- [x] Médio: verificar contrato USDT TRC-20 real na verificação Tron.
- [x] Médio: limite do chat à prova de envios simultâneos (RPC com trava de transação).
- [x] Rodar testes + compilação; aplicar migração também no banco do site publicado (FILES). zod atualizado para 4.6.6.
- [ ] Pendentes de menor risco: revisão das políticas antigas de leitura anônima, alvo obrigatório na renovação legada e novo scan da aba Security. Exigem deploy externo para valer no site publicado.

## Pedido 26/10 — admin e chat ao vivo
- [x] Chat: idempotência no envio (clientId único) para retry não duplicar mensagem.
- [x] Chat: fallback de envio não pode descartar anexo e anunciar sucesso.
- [x] Chat: conclusão de envio/IA valida thread ativa (resposta não entra em conversa trocada).
- [x] Chat: hasMore do histórico separado do refresh da cauda.
- [x] Chat admin: assumir/encerrar verificam erros e assumir usa compare-and-set.
- [x] Chat admin: loadThreads com proteção contra resposta fora de ordem.
- [x] Cliente: remover fluxo duplicado de mensagens/realtime em suporte.tsx.
- [x] Admin: auditoria real (staff_audit_logs) em vez de dados fictícios.
- [x] Admin: corrida na busca global (requestId) e estado de erro.
- [x] Admin: preservar ticket selecionado ao abrir aba de chat.
- [x] 445 testes passaram, tipos limpos, build OK; página de suporte sem erros no navegador (redireciona ao login deslogado).
- [ ] Conferir chat e admin com conta real e atualizar o site externo (deploy Vercel sem cache): sessão de admin indisponível no preview.

## Pedido 27/10 — revisão defensiva do admin e chats
- [x] Anexos: validação canônica compartilhada antes da assinatura nos dois envios; admin rejeita arquivos de outras conversas. Histórico admin renova links temporários e valida existência da conversa.
- [x] Privacidade: fallback de leitura do cliente mantém filtro de proprietário; erros de gravação não anunciam sucesso. Sem mudanças em vendas ou entrega de licenças.
- [x] 31 testes direcionados passaram (24 novos), incluindo chamadas de handlers com dependências simuladas; compilação automática sem erros.
- [ ] Validação autenticada ponta a ponta bloqueada: a conta do solicitante não foi localizada na autenticação gerenciada; entrar no preview com conta autorizada para conferir. Site externo não foi atualizado nesta revisão.
