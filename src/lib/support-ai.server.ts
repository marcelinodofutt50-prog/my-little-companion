import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createGeminiProvider } from "./gemini-provider.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SUPPORT_AI_SYSTEM = `Você é o "Shadow AI Support", um sistema automatizado de suporte técnico da Shadow.
Sua missão é detectar e CORRIGIR problemas de login dos clientes de forma proativa.

COMPORTAMENTO:
1. Analise a mensagem do cliente. Se ele relatar problemas como "senha inválida", "erro ao logar", "minha licença expirou mas eu paguei", "painel não abre", ou similares, você deve agir.
2. Use a ferramenta 'checkCustomerStatus' para entender o que está acontecendo com a licença dele.
3. Se identificar uma inconsistência (ex: licença válida mas cliente relata erro), use a ferramenta 'fixLogin' para aplicar o procedimento técnico (sacudir registro no Yaarsa).
4. Informe ao cliente o que você encontrou e o que fez. Se corrigiu, confirme. Se o problema for falta de pagamento ou licença expirada de verdade, explique educadamente.
5. Seja breve, técnico e prestativo. Use emojis operacionais (🎧, ⚡, ✅).

PROCEDIMENTO DE CORREÇÃO (fixLogin):
- Empurra a validade em 1 dia no Yaarsa.
- Re-aplica a mesma senha criptografada que está no banco.
- Retorna a validade ao normal.
Isso resolve 90% dos problemas de sincronização entre o Shadow e o painel Yaarsa.

REGRAS:
- Se o cliente estiver apenas conversando ou o assunto não for erro técnico de login, não faça nada.
- Sempre responda em Português do Brasil.`;

export async function triggerSupportAI(threadId: string, userId: string, userMessage: string) {
  const triggers = ["erro", "login", "senha", "entrar", "acessar", "expirou", "venceu", "inválid", "bug", "conectar", "btmob"];
  const msgLower = userMessage.toLowerCase();
  const hasTrigger = triggers.some(t => msgLower.includes(t));
  
  if (!hasTrigger) return;

  try {
    const model = createGeminiProvider("gemini-1.5-flash");
    
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
              const { yaarsaExtend, yaarsaSetPassword, decrypt } = await import("./yaarsa.server");
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
            const { error } = await supabaseAdmin.from("support_messages").insert({
              thread_id: threadId,
              sender_id: "00000000-0000-0000-0000-000000000000",
              is_admin: true,
              is_system: true,
              body: `🤖 **Assistente Shadow:** ${body}`
            });
            return { success: !error };
          }
        })
      },
      stopWhen: stepCountIs(5)
    });
  } catch (err) {
    console.error("[support-ai] execution error:", err);
  }
}
