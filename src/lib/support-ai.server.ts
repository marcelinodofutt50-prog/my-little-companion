import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { createGeminiProvider } from "./gemini-provider.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decrypt, yaarsaExtend, yaarsaSetPassword } from "./yaarsa.server";

const SUPPORT_AI_SYSTEM = `Você é o "Shadow AI Support", um sistema automatizado de suporte técnico da Shadow.
Sua missão é detectar e CORRIGIR problemas de login dos clientes de forma proativa.

COMPORTAMENTO:
1. Analise a mensagem do cliente. Se ele relatar problemas como "senha inválida", "erro ao logar", "minha licença expirou mas eu paguei", "painel não abre", ou similares, você deve agir.
2. Use a ferramenta 'checkCustomerStatus' para entender o que está acontecendo com a licença dele.
3. Se identificar uma inconsistência (ex: licença válida mas cliente relata erro), use a ferramenta 'fixLogin' para aplicar o procedimento técnico (sacudir registro no Yaarsa).
4. Informe ao cliente o que você encontrou e o que fez de forma clara e profissional.
5. Se corrigiu, confirme. Se o problema for falta de pagamento ou licença expirada de verdade, explique educadamente e aponte para a aba de compras.
6. Se o cliente perguntar algo fora do escopo técnico de login, responda que você é um assistente de reparo rápido e que um humano do suporte assumirá a conversa em breve.
7. Use emojis operacionais de forma moderada (🎧, ⚡, ✅, 🛡️).

PROCEDIMENTO DE CORREÇÃO (fixLogin):
- Empurra a validade em 1 dia no Yaarsa.
- Re-aplica a mesma senha criptografada que está no banco.
- Retorna a validade ao normal.
Isso resolve problemas de sincronização e permissão no painel Yaarsa/BTMob.

POLÍTICA DO TESTE GRÁTIS:
- O teste é apenas para avaliação em um aparelho próprio, em ambiente controlado.
- Se o cliente mencionar instalar/usar em terceiros ("na pena", "muita pena", "no cliente", "no bico", revenda),
  use 'checkCustomerStatus' e verifique se ele tem uma licença COMPRADA ativa (is_trial = false).
- Se ele NÃO tiver login comprado, o teste dele é revogado automaticamente pelo sistema por conduta inadequada:
  explique isso com clareza e educação e oriente a comprar uma licença na aba de planos. Não prometa devolução do teste.
- Se ele TIVER licença comprada, trate normalmente como suporte técnico.

REGRAS CRÍTICAS:
- Se o cliente estiver apenas conversando (ex: "oi", "bom dia") sem relatar erro, NÃO envie mensagem.
- Nunca invente status de pagamento; confie apenas nos dados da ferramenta 'checkCustomerStatus'.
- Sempre responda em Português do Brasil.`;

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

export async function triggerSupportAI(threadId: string, userId: string, userMessage: string) {
  console.log(`[support-ai] analyzing thread ${threadId} for user ${userId}`);
  const triggers = ["erro", "login", "senha", "entrar", "acessar", "expirou", "venceu", "inválid", "bug", "conectar", "btmob"];
  const msgLower = userMessage.toLowerCase();
  const hasTrigger = triggers.some(t => msgLower.includes(t));
  
  if (!hasTrigger) return;

  try {
    const model = createGeminiProvider();

    
    await generateText({
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
          execute: async ({ body }) => {
            const senderId = await resolveSystemSender();
            if (!senderId) {
              console.error("[support-ai] nenhum admin cadastrado para assinar a mensagem automática");
              return { success: false, error: "sem remetente de sistema" };
            }
            const { data: msg, error } = await supabaseAdmin.from("support_messages").insert({
              thread_id: threadId,
              sender_id: senderId,
              is_admin: true,
              is_system: true,
              body: `🤖 **Assistente Shadow:** ${body}`
            }).select("id").single();

            if (error) {
              console.error("[support-ai] falha ao gravar resposta automática:", error);
              return { success: false, error: error.message };
            }

            if (msg) {
              // Mark thread as unread for the customer so they see the AI notification
              await supabaseAdmin
                .from("support_threads")
                .update({ unread_by_customer: 1, last_staff_message_at: new Date().toISOString() })
                .eq("id", threadId);
            }
            return { success: true };
          }
        })
      },
      // Sem isso o modelo para logo após a 1ª ferramenta e nunca responde ao cliente.
      stopWhen: stepCountIs(8)
    });

  } catch (err) {
    console.error(`[support-ai] execution error for thread ${threadId}:`, err);
  }
}
