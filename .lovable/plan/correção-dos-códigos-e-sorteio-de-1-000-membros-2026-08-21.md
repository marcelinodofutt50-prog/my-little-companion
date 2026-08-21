# Correção dos códigos e sorteio de 1.000 membros

## Objetivo
Estabilizar a criação e o resgate de códigos de cortesia, cobrir os fluxos de admin/suporte e cliente com testes e preparar um sorteio único, automático e auditável quando a comunidade alcançar 1.000 contas válidas.

## Implementação

### 1. Reparar e fortalecer os códigos de cortesia
- Garantir que `redeem_codes` e `redeem_code_uses` estejam publicados corretamente na API do banco, com permissões para admin/suporte e leitura do próprio histórico pelo cliente.
- Mover o consumo do código e a reserva do resgate para uma operação atômica no banco, evitando ultrapassar o limite de usos, duplicidade entre abas e rollback que desfaça o resgate de outra pessoa.
- Manter validação de expiração, status, quantidade, plano e licença pertencente ao cliente.
- Melhorar mensagens para tabela indisponível, código duplicado, esgotado, expirado, painel de licenças indisponível e resgate já processado.
- Exibir no admin os códigos, estado, usos e histórico com atualização consistente; permitir criação para admin, suporte e moderador conforme as regras atuais.

### 2. Sorteio comunitário aos 1.000 membros
- Criar estruturas próprias para a campanha e seus 5 vencedores, com execução única e histórico auditável.
- Considerar elegíveis somente contas válidas: sem bloqueio de trial e sem avaliação antifraude bloqueada; excluir equipe e evitar vencedores repetidos.
- Ao alcançar 1.000 membros válidos, selecionar 5 pessoas distintas aleatoriamente no banco e atribuir prêmios mistos predefinidos: 1 vitalícia, 2 mensais de 30 dias e 2 semanais de 7 dias.
- Gerar para cada vencedor um código pessoal, de uso único e vinculado à sua conta, para que o prêmio seja ativado pelo fluxo seguro de resgate sem expor credenciais.
- Tornar o gatilho idempotente: chamadas concorrentes ou recarregamentos nunca repetem o sorteio nem trocam vencedores.
- Verificar a meta em chamadas autenticadas do Shadow Pass e disponibilizar também um acionamento manual seguro para admin/suporte, sem criar trabalho em segundo plano recorrente.

### 3. Resultado no Shadow Pass
- Adicionar uma seção de meta comunitária mostrando progresso até 1.000 membros.
- Depois do sorteio, mostrar os cinco vencedores com apelido público/anônimo e o tipo de prêmio, sem divulgar e-mail ou outros dados pessoais.
- Para o vencedor autenticado, destacar que ganhou e permitir copiar/resgatar seu código pessoal.

### 4. Testes e validação
- Testes unitários das regras de validade, elegibilidade e composição dos prêmios.
- Testes de integração do admin/suporte criando e desativando códigos e do cliente conferindo/resgatando códigos.
- Testes de concorrência para clique duplo, múltiplas sessões, último uso disponível e execução simultânea do sorteio.
- Testes de autorização para impedir clientes de criar códigos, visualizar códigos alheios ou forjar vencedores.
- Executar a suíte existente, verificar build, logs e os fluxos renderizados no navegador.

## Detalhes técnicos
- Alterações estruturais serão aplicadas por migration com RLS e grants explícitos.
- A operação crítica de resgate será uma função transacional `SECURITY DEFINER`, validando `auth.uid()` e mantendo privilégios mínimos.
- O sorteio usará unicidade no banco para campanha, posição e usuário; o resultado será persistido antes de ser exibido.
- Nenhum prêmio será criado agora: o banco atual tem 15 membros, portanto a campanha ficará aguardando a meta real de 1.000.
