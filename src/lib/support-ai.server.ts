import { generateText, tool } from "ai";
import { createGeminiProvider } from "./gemini-provider.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminFixLoginBug } from "./admin.functions";

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
  // Filtro rápido de palavras-chave para evitar invocar a IA em toda mensagem (economia de tokens)
  const triggers = ["erro", "login", "senha", "entrar", "acessar", "expirou", "venceu", "inválid", "bug", "conectar"];
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
          inputSchema: Buffer.alloc(0), // No input needed, uses context userId
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
          inputSchema: import("zod").then(z => z.z.object({ licenseId: z.z.string().uuid() })),
          execute: async ({ licenseId }) => {
            try {
              // Reutiliza a lógica admin já existente que faz exatamente o que o usuário pediu
              // Note: adminFixLoginBug exige context com auth, aqui simulamos o contexto admin
              const result = await adminFixLoginBug.handler({ 
                data: { licenseId }, 
                context: { userId: "system-ai", supabase: supabaseAdmin } as any 
              });
              return result;
            } catch (e: any) {
              return { error: e.message };
            }
          }
        }),
        postAIMessage: tool({
          description: "Envia uma mensagem de resposta da IA para o chat do suporte.",
          inputSchema: import("zod").then(z => z.z.object({ body: z.z.string() })),
          execute: async ({ body }) => {
            const { data, error } = await supabaseAdmin.from("support_messages").insert({
              thread_id: threadId,
              sender_id: "00000000-0000-0000-0000-000000000000", // UUID reservado para Sistema/IA
              is_admin: true,
              is_system: true,
              body: `🤖 **Assistente Shadow:** ${body}`
            });
            return { success: !error };
          }
        })
      },
      maxSteps: 5 // Permite que ela verifique, corrija e poste
    });
  } catch (err) {
    console.error("[support-ai] execution error:", err);
  }
}
