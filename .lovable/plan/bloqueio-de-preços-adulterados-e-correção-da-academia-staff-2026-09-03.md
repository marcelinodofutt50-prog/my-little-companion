# Bloqueio de preços adulterados e correção da Academia Staff

## Objetivo
Fechar a brecha que permite criar pedidos com valor manipulado (como R$ 0,01), impedir que pedidos antigos adulterados sejam entregues e fazer a Central de Treinamento funcionar no ambiente publicado da Vercel.

## Diagnóstico confirmado
- O navegador possui permissão direta para inserir em `orders`; a regra atual valida dono/status, mas **não valida `amount` nem `plan_slug`**. Um usuário autenticado pode ignorar a tela e inserir um pedido com preço arbitrário.
- Mercado Pago e Stripe usam o valor salvo no próprio pedido; portanto, um pedido adulterado vira um checkout real de baixo valor. O webhook compara o pagamento ao pedido adulterado, não ao preço oficial.
- Há ainda um bypass crítico no pagamento cripto: uma transferência on-chain de valor zero vira a string `"0"` (truthy), alcança o estado `confirmed` e pula a trava final porque ela só rejeita subpagamento quando `paidBrl > 0`.
- O banco publicado usado pela Vercel não possui `staff_trainings` nem `staff_training_progress` (`PGRST205`). O fallback de autenticação não resolve uma tabela ausente.
- O ambiente gerenciado e o ambiente externo publicado estão divergentes; a correção precisa existir no repositório e ser aplicada aos dois bancos.

## Implementação

### 1. Tornar a criação de pedidos exclusivamente server-side
- Remover a permissão e a policy que permitem ao cliente inserir diretamente em `orders`.
- Alterar `createCheckout` e `createMarketCheckout` para gravarem pedidos somente pelo cliente privilegiado carregado dentro do handler, depois de autenticar o usuário e calcular o preço no servidor.
- Restringir `planSlug`, origem de retorno e combinações de add-ons/cupom/cashback com validações explícitas.

### 2. Criar uma fonte única de preço confiável
- Centralizar o cálculo canônico do pedido em código server-only, lendo preço/estado do plano, cupom válido, cashback disponível e add-ons autorizados.
- Salvar no metadata um snapshot de preço calculado no servidor (preço-base, descontos, adicionais e total) para auditoria.
- Antes de abrir qualquer checkout, recalcular e rejeitar/inutilizar pedidos cujo total não corresponda ao preço oficial.

### 3. Endurecer webhooks e fulfillment
- Stripe e Mercado Pago deverão validar: pedido existente, vínculo correto, status pagável, moeda BRL, total pago e total canônico.
- Não confiar apenas em `order.amount`; pedidos antigos adulterados serão bloqueados antes da entrega.
- Reforçar idempotência e impedir reutilização de pagamento/sessão em outro pedido.
- Adicionar uma barreira final no fulfillment para nunca gerar licença/entrega sem uma confirmação de pagamento validada pelo provedor.
- No cripto, exigir valor on-chain estritamente maior que zero, impedir confirmação sem valor BRL verificado e rejeitar qualquer total ausente, zero ou abaixo do limite do plano.

### 4. Corrigir dados suspeitos e proteger o banco
- Criar migração com função/trigger de proteção para impedir alteração de campos financeiros e de identidade do pedido fora do contexto confiável do servidor.
- Identificar pedidos pendentes com total abaixo do preço canônico, marcá-los como inválidos/cancelados e registrar auditoria; não alterar pedidos legítimos pagos sem revisão.
- Aplicar a mesma migração no Lovable Cloud e no banco externo usado pela Vercel.

### 5. Restaurar a Central de Treinamento na Vercel
- Aplicar no banco publicado a migração existente que cria `staff_trainings`, `staff_training_progress`, permissões, políticas, triggers e módulos iniciais.
- Manter a leitura/escrita pelo usuário autenticado com RLS, sem depender da chave administrativa para uso normal.
- Melhorar o erro exibido quando a infraestrutura estiver ausente e validar reprodução de vídeos/links no domínio publicado.
- Reforçar a verificação de identidade do deploy para não aceitar silenciosamente configuração parcial do backend em produção.

## Validação
- Testes unitários de cálculo: preço normal, add-ons, cupom, cashback, mercado e renovação.
- Testes de abuso: INSERT direto com R$ 0,01, alteração de `amount`, checkout com pedido adulterado, webhook subpago, moeda errada, reutilização de pagamento e transferência cripto de valor zero — todos devem falhar sem entrega.
- E2E autenticado dos dois checkouts sem concluir cobrança real, confirmando que o valor exibido/provedor vem do servidor.
- E2E autenticado da Academia na rota dedicada e no admin: listar módulos, abrir conteúdo/vídeo, marcar progresso e criar/editar módulo como admin.
- Verificar typecheck, suíte automatizada, build e logs do ambiente publicado.

## Observação operacional
A Vercel usa um banco externo diferente do ambiente gerenciado. A correção só estará completa quando a migração estiver aplicada nos dois ambientes e o deploy tiver as variáveis server-side apontando para o mesmo banco que o frontend.
