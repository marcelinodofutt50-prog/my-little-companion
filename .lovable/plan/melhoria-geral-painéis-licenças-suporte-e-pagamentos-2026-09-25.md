# Melhoria geral — painéis, licenças, suporte e pagamentos

## Direção escolhida
- **Visual:** Terminal refinado — fundo escuro esverdeado, verde técnico e ciano.
- **Tipografia:** Sora nos títulos e Manrope nos textos.
- **Organização:** painel operacional, com resumo claro, ações prioritárias e informações agrupadas.
- **Licença antiga:** verificação automática primeiro; casos inconclusivos seguem para análise da equipe.

## O que será entregue

### 1. Comunidade e planos
- Ativar o Telegram oficial no topo com o link enviado.
- Exibir o Discord como **Callionis**, com ação de copiar o nome enquanto não houver um convite clicável.
- Adicionar no início de Planos um bloco objetivo de pagamento alternativo, com símbolo do Bitcoin e acesso à página de criptomoedas.
- Integrar a página de cripto à navegação existente, sem alterar a página inicial.

### 2. Painel do cliente
- Reorganizar o topo como painel operacional: situação da conta/licença, ação recomendada e atalhos agrupados.
- Reduzir ruído visual e duplicações, preservando todas as funções atuais.
- Aplicar animações leves de entrada e resposta, com respeito à preferência de movimento reduzido.
- Manter “Reparar acesso” como ação principal quando houver falha de login, com retorno claro de cada etapa.

### 3. Reparar acesso e servidores 4.6/4.5.x
- Corrigir a seleção do servidor/painel para que cada licença use a integração correta.
- Tornar o reparo idempotente e resistente a respostas lentas, sem criar logins duplicados.
- Melhorar diagnóstico, retentativas controladas e mensagens para diferenciar credencial inválida, painel indisponível e sincronização pendente.
- Cobrir 4.6, 4.5.7 e compatibilidade legada 4.5.5 com testes específicos.

### 4. Licença antiga no suporte
- Criar uma entrada destacada no Suporte: “Já tem uma licença e quer renovar ou vincular?”.
- Formulário unificado com e-mail de identificação, login/licença BTmob, senha da licença, servidor/versão e IP.
- **Não solicitar senha do Gmail.** O e-mail serve apenas para identificação; credenciais sensíveis ficam restritas ao servidor.
- Tentar validação automática no painel correto. Se confirmada, vincular a licença e encaminhar ao pagamento; se inconclusiva, abrir análise para a equipe com o diagnóstico já preenchido.
- Mostrar essa fila e seu histórico no painel administrativo.

### 5. Painel administrativo
- Melhorar a leitura operacional de licenças, solicitações antigas, pagamentos e falhas das rotinas automáticas.
- Acrescentar filtros, estados claros, ações seguras e histórico de tentativas onde hoje há retorno insuficiente.
- Preservar permissões da equipe e exigir confirmação nas ações destrutivas.

### 6. Rotinas automáticas e confiabilidade
- Revisar autenticação, tempo limite, idempotência, travas, retentativas e logs das tarefas agendadas.
- Exibir no admin a última execução, duração, resultado e próximo passo para falhas recuperáveis.
- Evitar processamento duplicado em licenças, pagamentos e reconciliações.

### 7. Segurança e pagamentos
- Revisar validações no cliente e no servidor, permissões, exposição de dados e transições de status.
- Manter confirmação de PIX no provedor antes da entrega.
- Endurecer cripto contra reaproveitamento de transação; até a escolha definitiva entre aprovação manual e valor único, não ampliar a automação insegura.

## Verificação
- Testes unitários e de integração focados nos fluxos alterados.
- Testes de ponta a ponta: painel do cliente, reparo por versão, licença antiga → validação → pagamento/análise, admin e cripto.
- Verificação visual em desktop e celular, incluindo animações e ausência de sobreposição.
- Conferência final dos erros de compilação, execução e rede.

## Limites e decisões seguras
- A página inicial permanece intacta.
- O Discord será copiável como **Callionis**; para abrir diretamente no Discord será necessário um link de convite ou perfil válido.
- Não será armazenada senha de Gmail.
- Publicação no site real só será feita quando solicitada explicitamente.
