import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { withGeminiFallback } from "./gemini-provider.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decrypt, yaarsaExtend, yaarsaSetPassword } from "./yaarsa.server";
import { buildPixInstructions, isCheckoutFailureMessage } from "./pix";

const SUPPORT_AI_SYSTEM = `Você é o "Shadow AI Support", o atendente automatizado de primeiro nível da Shadow.
Fale como um técnico humano experiente: direto, gentil, sem enrolação e SEMPRE em Português do Brasil.

FORMATO OBRIGATÓRIO DA RESPOSTA (o chat é lido no celular):
- Máximo 6 linhas curtas.
- Comece com uma frase de diagnóstico ("Verifiquei sua conta: ...").
- Depois, se houver ação do cliente, liste passos numerados curtos (1., 2., 3.).
- Termine com UMA pergunta objetiva ou o próximo passo.
- Nada de textão, nada de repetir a pergunta do cliente, no máximo 2 emojis (🎧 ⚡ ✅ 🛡️).

FLUXO:
1. Leia a mensagem. Se relatar erro de login/senha/painel/licença, use 'checkCustomerStatus' ANTES de responder.
2. Se houver inconsistência (licença válida no banco mas cliente não entra), use 'fixLogin' na licença correta e confirme o reparo.
3. Se a licença estiver realmente vencida ou não existir, explique com clareza e aponte a aba de planos.
4. Sempre finalize enviando a resposta com 'postAIMessage'. Sem isso o cliente não recebe nada.
5. Assunto fora de login/licença: diga em 2 linhas que um atendente humano assume em seguida, e não invente solução.

PROCEDIMENTO DE CORREÇÃO (fixLogin):
- Empurra a validade em 1 dia no Yaarsa.
- Re-aplica a mesma senha criptografada que está no banco.
- Retorna a validade ao normal.
Isso resolve problemas de sincronização e permissão no painel Yaarsa/BTMob.

POLÍTICA DO TESTE GRÁTIS (seja específico, nunca genérico):
- O teste é 1 por pessoa/aparelho, apenas para avaliação em aparelho próprio.
- Se o cliente mencionar instalar/usar em terceiros ("na pena", "muita pena", "no cliente", "no bico", revenda),
  use 'checkCustomerStatus' e confira se existe licença COMPRADA ativa (is_trial = false).
- Sem licença comprada: o teste é revogado automaticamente por conduta inadequada. Explique
  (a) o que foi detectado, (b) por que a regra existe, (c) que a compra libera acesso imediato. Não prometa devolução.
- Se o cliente disser que o teste foi bloqueado, explique os motivos possíveis de forma concreta:
  mesmo aparelho já usado, e-mail variante da mesma caixa, e-mail temporário, ou várias contas na mesma rede.
  Peça o código de protocolo (formato TRL-AAMMDD-XXXXXX ou APK-...) para revisão humana.
- Com licença comprada: trate normalmente como suporte técnico, sem acusações.

PAGAMENTO / CHECKOUT:
- Se o cliente disser que não consegue abrir ou concluir o checkout (Mercado Pago/Stripe/cartão/Pix),
  chame 'sendPixInstructions'. Ela já envia a chave PIX oficial e o passo a passo. Não digite a chave você mesmo.

REGRAS CRÍTICAS:
- Se for só conversa ("oi", "bom dia") sem relato de erro, NÃO chame 'postAIMessage'.
- Nunca invente status de pagamento; use apenas dados do 'checkCustomerStatus'.
- Nunca peça senha, cartão ou dados pessoais ao cliente.`;


/**
 * O remetente das mensagens automáticas precisa existir em auth.users (há uma
 * chave estrangeira em support_messages.sender_id). Usamos a conta de um admin
 * real como "remetente do sistema"; antes usávamos um UUID zerado e TODA
 * resposta da IA falhava silenciosamente ao ser gravada.
 */
let systemSenderCache: string | null = null;
async function resolveSystemSender(): Promise<string | null> {
  if (systemSenderCache) return systemSenderCache;
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  systemSenderCache = data?.user_id ?? null;
  return systemSenderCache;
}

/** Grava uma mensagem automática no chat (usada pela IA e pelo fluxo do PIX). */
async function postSystemMessage(threadId: string, body: string) {
  const senderId = await resolveSystemSender();
  if (!senderId) {
    console.error("[support-ai] nenhum admin cadastrado para assinar a mensagem automática");
    return { success: false, error: "sem remetente de sistema" };
  }
  const { error } = await supabaseAdmin.from("support_messages").insert({
    thread_id: threadId,
    sender_id: senderId,
    is_admin: true,
    is_system: true,
    body: `🤖 **Assistente Shadow:** ${body}`,
  });
  if (error) {
    console.error("[support-ai] falha ao gravar resposta automática:", error);
    return { success: false, error: error.message };
  }
  await supabaseAdmin
    .from("support_threads")
    .update({ unread_by_customer: 1, last_staff_message_at: new Date().toISOString() })
    .eq("id", threadId);
  return { success: true };
}

export async function triggerSupportAI(threadId: string, userId: string, userMessage: string) {
  console.log(`[support-ai] analyzing thread ${threadId} for user ${userId}`);
  const triggers = [
    "erro", "error", "login", "logar", "senha", "entrar", "acessar", "acesso", "expirou", "venceu",
    "vencid", "inválid", "invalid", "bug", "conectar", "conexão", "btmob", "yaarsa", "painel",
    "licen", "teste", "trial", "bloque", "negad", "protocolo", "play protect", "apk",
    "pena", "bico", "cliente", "revend", "pix", "pagamento", "paguei", "não funciona", "nao funciona",
  ];

  const msgLower = userMessage.toLowerCase();

  // PIX: nunca enviamos a chave de cara. Só quando o cliente relata problema de
  // checkout/pagamento — e ainda assim pedimos confirmação antes de responder.
  const pixOffered = await hasPendingPixOffer(threadId);
  if (pixOffered && (isAffirmativeReply(userMessage) || isExplicitPixRequest(userMessage))) {
    await postSystemMessage(threadId, buildPixInstructions());
    return;
  }
  if (!pixOffered && isCheckoutFailureMessage(userMessage)) {
    await postSystemMessage(threadId, buildPixOffer());
    return;
  }
  if (!pixOffered && isExplicitPixRequest(userMessage) && isCheckoutFailureMessage(userMessage)) {
    await postSystemMessage(threadId, buildPixOffer());
    return;
  }

  const hasTrigger = triggers.some(t => msgLower.includes(t));

  if (!hasTrigger) return;

  try {
    await withGeminiFallback((model) => generateText({
      model,
      system: SUPPORT_AI_SYSTEM,
      prompt: `Usuário (ID: ${userId}) na conversa ${threadId} disse: "${userMessage}"`,
      tools: {
        checkCustomerStatus: tool({
          description: "Verifica o status atual das licenças e pedidos do cliente.",
          inputSchema: z.object({}),
          execute: async () => {
            const [lics, orders] = await Promise.all([
              supabaseAdmin.from("licenses").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
              supabaseAdmin.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5)
            ]);
            return {
              licenses: lics.data ?? [],
              recentOrders: orders.data ?? []
            };
          }
        }),
        fixLogin: tool({
          description: "Aplica o procedimento de 'sacudir registro' (correção de login) para uma licença específica.",
          inputSchema: z.object({ licenseId: z.string().uuid() }),
          execute: async ({ licenseId }) => {
            try {
              // Helper methods are now imported at top level to ensure clarity and professional code structure.
              const { data: lic } = await supabaseAdmin.from("licenses").select("*").eq("id", licenseId).maybeSingle();
              if (!lic) return { error: "Licença não encontrada" };
              if (lic.disabled_at) return { error: "Licença desativada" };

              const panel = ((lic as any).panel ?? "v457") as "v457" | "v46";
              const ymd = (d: Date) => d.toISOString().slice(0, 10);
              const original = lic.expires_at ? new Date(lic.expires_at) : null;
              const bumped = original ? new Date(original.getTime() + 24 * 60 * 60 * 1000) : null;

              if (original && bumped) {
                await yaarsaExtend(lic.yaarsa_email, ymd(bumped), panel);
              }
              
              const plain = decrypt(lic.yaarsa_password_enc);
              await yaarsaSetPassword(lic.yaarsa_email, plain, panel, lic.yaarsa_username ?? undefined);

              if (original) {
                await yaarsaExtend(lic.yaarsa_email, ymd(original), panel);
              }

              return { ok: true, message: "Login corrigido com sucesso via Yaarsa API" };
            } catch (e: any) {
              return { error: e.message };
            }
          }
        }),
        postAIMessage: tool({
          description: "Envia uma mensagem de resposta da IA para o chat do suporte.",
          inputSchema: z.object({ body: z.string() }),
          execute: async ({ body }) => postSystemMessage(threadId, body)
        }),
        sendPixInstructions: tool({
          description:
            "Envia os dados oficiais do PIX quando o cliente não consegue abrir/concluir o checkout.",
          inputSchema: z.object({}),
          execute: async () => postSystemMessage(threadId, buildPixInstructions())
        })
      },
      // Sem isso o modelo para logo após a 1ª ferramenta e nunca responde ao cliente.
      stopWhen: stepCountIs(8)
    }));

  } catch (err) {
    console.error(`[support-ai] execution error for thread ${threadId}:`, err);
  }
}
