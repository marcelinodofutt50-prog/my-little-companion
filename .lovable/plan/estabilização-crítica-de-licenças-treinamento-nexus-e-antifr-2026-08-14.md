# Estabilização crítica de licenças, treinamento, Nexus e antifraude

## Objetivo
Corrigir os fluxos que hoje dependem de espera/F5, eliminar erros de recurso inexistente no ambiente publicado e impedir abuso de trials sem bloquear clientes legítimos por falhas transitórias.

## Implementação

### 1. Compra até licença, sem espera manual
- Tornar a entrega idempotente e observável em todas as etapas: pagamento confirmado, provisionamento externo, gravação da licença e exibição no painel.
- Corrigir estados que podem ficar presos ou parecer concluídos sem uma licença associada.
- Reforçar a reconciliação automática de pagamentos aprovados e tentativas com erro, preservando contador, próxima tentativa e causa técnica.
- Fazer a página de sucesso e o dashboard atualizarem a licença imediatamente, com estado claro de processamento/erro e ação de nova verificação, sem exigir F5.
- Adicionar testes para webhook duplicado, falha temporária, recuperação e licença já criada.

### 2. Staff Nexus
- Validar tabela, colunas, permissões e cargo real do usuário separadamente.
- Corrigir a leitura/envio para não transformar falha de infraestrutura em “você não é admin”.
- Atualizar o cache da API do banco e adicionar diagnóstico seguro do ambiente quando a tabela não estiver publicada.
- Validar leitura e envio como usuário autenticado da equipe.

### 3. Centro de Treinamento
- Corrigir o upload assinado e verificar explicitamente a existência/configuração do bucket antes de emitir o token.
- Registrar no servidor etapa, usuário, tipo/tamanho e código da falha, sem registrar conteúdo sensível.
- Como o bucket é privado, trocar URLs públicas inválidas por acesso temporário assinado para reprodução dos membros.
- Validar upload, persistência do tutorial e reprodução após recarregar a página.

### 4. Antifraude de trial ponta a ponta
- Remover o comportamento “falhou a verificação, então libera”; falhas críticas passam a negar temporariamente com mensagem de tentar novamente.
- Aplicar atomicidade no resgate para impedir duas solicitações simultâneas e manter uma única intenção/licença de trial por usuário.
- Validar idade da conta, compra anterior, trial anterior, IP anonimizado e vínculo com contas recentes; manter allowlist administrativa auditável.
- Garantir que o hash de IP use salt configurado e que ausência de sinal não vire permissão automática sem controles compensatórios.
- Adicionar índices/regras necessários e testes de concorrência, multi-conta, repetição e falha de infraestrutura.

## Verificação
- Executar testes focados e checagem do app.
- Exercitar os fluxos autenticados disponíveis no preview.
- Consultar o banco após as ações para confirmar estado da ordem/licença, mensagem do Nexus, objeto/tutorial e bloqueio do segundo trial.
- Separar claramente o que foi validado na prévia e o que dependerá de publicar para validar no ambiente final.

## Detalhes técnicos
- Manter TanStack Start com `createServerFn`, autenticação server-side e validação Zod.
- Usar migração somente para regras, índices, funções e permissões; nenhuma abertura ampla de RLS.
- Não expor chaves, IPs, credenciais de licença ou detalhes internos nos erros mostrados ao usuário.
