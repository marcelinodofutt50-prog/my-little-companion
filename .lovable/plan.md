Escopo grande — vou dividir em blocos claros e implementar tudo em sequência. Antes de começar, alinho abaixo o que vai ser feito para você aprovar.

## 1. Chat de suporte estilo Ticket (admin + cliente)

**Backend (nova migration):**
- Colunas novas em `support_threads`: `assigned_to` (uuid do admin/suporte), `assigned_at`, `assigned_name` (snapshot do nome), `closed_at`, `closed_by`, `last_customer_message_at`, `unread_admin`, `unread_customer`.
- Novo status: `open` | `assigned` | `closed`.
- Trigger: quando cliente manda mensagem numa thread `closed`, cria automaticamente uma **nova thread** (o "ticket antigo" fica no histórico).
- Mensagem de sistema (novo tipo `is_system: true` em `support_messages`) para eventos: "Atendente Fulano assumiu a conversa", "Conversa encerrada por Fulano".

**Server functions novas:**
- `assumeThread(threadId)` — admin/suporte assume, grava assigned_*, insere mensagem de sistema.
- `closeThread(threadId)` — encerra ticket, insere mensagem de sistema, some da lista ativa.
- `listAdminThreads()` — lista com filtros: abertas / minhas / encerradas.

**UI Admin (`/admin` aba Suporte):**
- Layout de 2 colunas: lista de tickets à esquerda (com badge de não lidas, tempo desde última msg do cliente), chat à direita.
- Botão "Assumir conversa" bem visível quando não atribuída.
- Botão "Encerrar ticket" com confirmação.
- Mostra quem assumiu.

**UI Cliente (`/suporte`):**
- Mostra mensagens de sistema em estilo próprio ("🎧 Ana do suporte entrou na conversa").
- Quando ticket é fechado: mostra "Conversa encerrada. Envie uma nova mensagem para abrir outro atendimento." e o próximo envio abre thread nova (histórico da antiga fica acessível numa aba "Histórico").

## 2. Dashboard Admin mais profissional

- KPIs no topo: MRR, vendas hoje/7d/30d, ticket médio, taxa de conversão (orders pagas / orders criadas), licenças ativas, tickets abertos.
- Gráfico de vendas dos últimos 30 dias (recharts, já disponível).
- Tabela de últimas 10 vendas com status colorido.
- Ranking dos top 5 clientes por gasto.
- Melhora visual dos painéis existentes (APK, Updates, Market, Payers) com headers consistentes e espaçamento.

## 3. Site do cliente — prova social, marketing e conversão

**Landing (`/`) e `/planos`:**
- Seção de prova social: contador de clientes ativos, últimas ativações ("João de SP acabou de ativar o plano Pro" — puxa de `orders` pagas, anonimiza nome).
- Selos de confiança: "Pagamento 100% seguro", "Suporte 24/7", "Ativação instantânea", "Garantia".
- Depoimentos (seção estática, deixo 3 slots que você edita depois).
- Countdown/urgência em promoções: "Oferta expira em X".
- CTA fixo no mobile ("Assinar agora").
- Comparativo de planos mais claro (destaque no plano recomendado).
- FAQ com objeções comuns.

**Checkout:**
- Selos de segurança visíveis (Mercado Pago, SSL).
- "X pessoas comprando agora" (contador simulado com base em vendas reais recentes).

## 4. Fluxo de pagamento — entrega automática

Auditoria e correção:
- Verificar `mp-webhook.ts`: após confirmar `paid`, garantir que:
  1. Cria licença no Yaarsa (já existe via `yaarsa.server.ts`).
  2. Salva credenciais criptografadas em `licenses`.
  3. Envia mensagem automática no chat de suporte do cliente: **"✅ Pagamento confirmado! Obrigado pela preferência. Seu login: `usuario` / senha: `xxx`. Expira em XX/XX."** com botão de copiar.
  4. Toast/notificação em tempo real na página de sucesso (via realtime na thread do cliente).
- Página `/pagamento/sucesso` já faz polling — melhorar: assim que status vira `paid`, mostrar as credenciais direto na tela (não só "vá ao suporte").
- Casos onde produto é físico/manual (mercado shadow): mensagem "Pagamento recebido! Um operador vai te entregar em instantes" + notificação para o admin.

## 5. Otimização e polimento

- Loading states melhores (skeletons em vez de spinners onde faz sentido).
- Empty states com CTAs.
- Toasts de sucesso/erro consistentes.
- Meta tags SEO por rota (title, description, og).
- Lazy load de rotas pesadas (admin).
- Verifica console errors atuais e corrige.

## 6. Bugs & QA

- Rodar typecheck.
- Testar fluxo completo local: criar conta → comprar → webhook → receber login no chat.
- Checar RLS nas novas colunas/tabelas.
- Revisar logs para erros silenciosos.

---

## Confirmações que preciso antes de codar

1. **Prova social com dados reais** (nome parcial de clientes reais que compraram) — ok ou prefere mocks/depoimentos estáticos?
2. **Entrega automática do login no chat**: mando via mensagem de sistema no chat de suporte do próprio cliente (ele já tá logado, vê na hora). Ok?
3. **Contador "X comprando agora"**: pode ser levemente inflado com base em vendas reais ou você prefere só métricas verdadeiras?
4. Depoimentos: você me passa 3 depoimentos reais ou deixo placeholders para você preencher depois?

Assim que me confirmar (pode ser resposta curta tipo "1-sim, 2-sim, 3-real, 4-placeholder"), eu já começo a implementação inteira nas próximas mensagens.