# Blindagem antifraude: teste de 3h30, banimento por várias contas e reforço de segurança

## O que muda para o cliente

1. **Teste grátis cai para 3 horas e 30 minutos** (hoje é 1 dia).
2. **Aviso obrigatório antes de resgatar o teste.** Ao clicar em "Resgatar teste", abre uma janela com a mensagem abaixo. O botão "Li e concordo" só libera depois de marcar a caixa de confirmação e esperar alguns segundos:
   > Por causa da atitude de alguns membros, que criaram várias contas para resgatar o teste repetidas vezes e abusaram da boa vontade da nossa equipe, o teste grátis foi reduzido para **3 horas e 30 minutos**. O teste é **exclusivamente para uso pessoal**. É proibido colocar clientes ou "penas" no acesso de teste, revender acesso ou criar contas extras — isso viola as regras e políticas do site. Quem criar várias contas será **banido automaticamente**, inclusive nas contas futuras.
   O aceite fica registrado (data e aparelho) como prova.
3. **Banimento automático por várias contas.** Se o sistema ligar **4 ou mais contas** à mesma pessoa (mesmo aparelho, mesma impressão do navegador, mesmo e-mail disfarçado como `nome+1@` / `n.o.m.e@`, ou mesma rede junto com o mesmo aparelho), **todas** essas contas são banidas.
4. **O que a conta banida sofre:**
   - Não consegue resgatar teste, enviar APK grátis, resgatar códigos, usar a Comunidade, pedir indicação ou cashback, nem usar cupons.
   - **Preços 50% mais caros** em todos os planos. O acréscimo é calculado no servidor, então não dá para burlar pelo navegador.
   - Um aviso fixo no painel explica o banimento e indica o suporte.
   - Continua podendo entrar, ver as licenças que já comprou e falar com o suporte, para não travar quem pagou.
5. **O banimento acompanha a pessoa.** Qualquer conta nova criada no mesmo aparelho, navegador ou e-mail disfarçado de alguém banido já nasce banida.
6. **Comunidade (o caso do print):** mensagens com venda de acesso, preço ("25 conto", "R$"), Discord, WhatsApp, Telegram ou links são bloqueadas automaticamente. Reincidência gera mute e depois banimento.

## Painel do admin

- Nova aba **"Banimentos"**: lista de contas banidas, com o motivo, as contas ligadas e as provas (aparelho, e-mails, datas).
- Botões **Banir manualmente**, **Desbanir** (com opção de liberar ou não as contas ligadas) e **Ajustar acréscimo de preço** (padrão 50%).
- Tudo que o admin fizer fica registrado no histórico de auditoria.

## Brechas encontradas e como fecho cada uma

| Brecha atual | Correção |
|---|---|
| Rede (IP) nunca bloqueia sozinha, então dá para trocar de conta na mesma casa | Mesma rede + mesmo aparelho em 24h conta como a mesma pessoa |
| Sem identificação do aparelho, o motor só pontua e deixa passar | Sem identificação do aparelho, não sai teste |
| Limpar o navegador ou usar aba anônima gera identidade nova | Identificação por várias pistas combinadas (tela, fontes, placa de vídeo, fuso, idioma) e guardada em mais de um lugar do navegador |
| Contas criadas em sequência pelo mesmo aparelho só são vistas no momento do teste | A verificação roda também no **cadastro** e no **login**, e liga a conta nova às antigas na hora |
| E-mails temporários: lista curta | Lista ampliada de provedores descartáveis |
| Teste liberado para contas com até 72h | Reduz para 24h; e-mail precisa estar confirmado |
| Preço decidido no navegador em alguns pontos | Preço final sempre recalculado no servidor, já com o acréscimo de banido |
| Mensagens livres na Comunidade | Filtro de conteúdo no servidor + limite de envio |

## Detalhes técnicos

- **Banco (migração):**
  - Nova tabela `account_bans`: user_id, motivo, origem (auto/manual), `price_multiplier` (padrão 1.5), `linked_group_id`, criado_por, criado_em, revogado_em.
  - Nova tabela `ban_fingerprints`: device_hash, attrs_hash, email_canonical e ban_id, para herdar o banimento em contas novas.
  - Nova tabela `trial_consents` para o aceite do aviso.
  - Função `is_banned(uid)` security definer, só para uso do servidor.
  - RLS: o cliente lê apenas o próprio banimento; somente o servidor escreve. GRANTs conforme o padrão do projeto.
- **Servidor:**
  - `ban-engine.server.ts`: `linkAccounts(userId, signals)` agrupa contas por aparelho, atributos, e-mail canônico e a combinação rede + aparelho. Com 4 ou mais contas no grupo, bane todas e grava as impressões.
  - Chamado no cadastro/login (hook do dispositivo existente em `device.functions.ts`), no `generateTrial` e no `apk-jobs`.
  - `requireNotBanned` aplicado em: trial, APK grátis, redeem, comunidade, indicações, cupons.
  - Checkout (Mercado Pago/PIX, cripto, Stripe) aplica `price_multiplier` no valor calculado no servidor.
  - `internalGenerateTrial`: duração alterada para 3,5 horas, também no painel Yaarsa.
  - `generateTrial` passa a exigir `consentId` válido e recente.
- **Comunidade:** `community.functions.ts` ganha um filtro por regex (preço, contato externo, links) + limite de 5 mensagens por minuto + escalonamento de punições.
- **Front:** janela de aviso no botão de teste, faixa de banimento no painel, preços com acréscimo em `/planos`, aba "Banimentos" no admin. O visual da página inicial e do painel não muda (só entram a janela e a faixa).
- **Testes:** unitários do agrupamento (3 contas passam, a 4ª bane todas), herança do banimento em conta nova, preço com multiplicador, filtro da comunidade, trial de 3h30 e consentimento obrigatório. Depois, E2E com contas temporárias no banco novo.
- **Aplicação:** a migração é aplicada no banco de produção novo (o mesmo usado pelo site na Vercel) e no ambiente de teste.

## Pontos para você confirmar (se não disser nada, uso o padrão)

- Acréscimo de preço para banidos: **50%**.
- Limite: **4 contas** banem todas.
- Contas antigas que já passam do limite hoje: **banir já na ativação**, ou só a partir de agora? (padrão: só a partir de agora, com uma lista para você revisar no admin)
