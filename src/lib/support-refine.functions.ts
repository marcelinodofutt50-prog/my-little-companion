import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Reescreve o rascunho do atendente em um texto formal, claro e adequado ao que
 * o cliente escreveu. Usa o histórico recente da conversa como contexto.
 */
export const refineSupportReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: any) =>
    z
      .object({
        threadId: z.string().uuid(),
        draft: z.string().trim().min(1, "Escreva algo antes de refinar").max(4000),
        tone: z.enum(["formal", "empatico", "direto"]).default("formal"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: thread } = await supabaseAdmin
      .from("support_threads")
      .select("id, user_id, category")
      .eq("id", data.threadId)
      .maybeSingle();
    if (!thread) throw new Error("Conversa não encontrada");

    const { resolveRoles } = await import("@/lib/roles.server");
    const { isStaff } = await resolveRoles(context);
    if (!isStaff && thread.user_id !== context.userId) throw new Error("Acesso negado a esta conversa");

    const { data: messages } = await supabaseAdmin
      .from("support_messages")
      .select("body, is_admin, is_system, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: false })
      .limit(6);

    const history = (messages ?? [])
      .reverse()
      .filter((m) => (m.body ?? "").trim())
      .map((m) => `${m.is_system ? "Assistente" : m.is_admin ? "Suporte" : "Cliente"}: ${(m.body ?? "").slice(0, 300)}`)
      .join("\n");

    const toneRule =
      data.tone === "empatico"
        ? "Tom acolhedor e empático, mas ainda profissional."
        : data.tone === "direto"
          ? "Tom objetivo e enxuto, sem rodeios, ainda educado."
          : "Tom formal, cordial e profissional.";

    const { generateText } = await import("ai");
    const { withGeminiFallback } = await import("./gemini-provider.server");

    const { text } = await withGeminiFallback((model) => generateText({
      model,
      maxOutputTokens: 500,
      system: [
        "Você reescreve mensagens de atendentes de suporte da Shadow, sempre em Português do Brasil.",
        toneRule,
        "REGRAS:",
        "- Preserve exatamente o significado, as instruções, valores, prazos, links e credenciais do rascunho.",
        "- Não invente informação, não prometa nada que não esteja no rascunho.",
        "- Responda de forma coerente com a última mensagem do cliente (use o contexto da conversa).",
        "- Corrija ortografia, gramática e pontuação. Use frases curtas.",
        "- Se houver passos, use lista numerada curta (1., 2., 3.).",
        "- Máximo 6 linhas. No máximo 1 emoji, e só se combinar.",
        "- Devolva SOMENTE o texto final da mensagem, sem aspas, sem comentários e sem títulos.",
      ].join("\n"),
      prompt:
        `Contexto da conversa (mais recente ao final):\n${history || "(sem mensagens anteriores)"}\n\n` +
        `Rascunho do atendente para reescrever:\n"""${data.draft}"""`,
    }));

    const cleaned = (text ?? "").trim().replace(/^"+|"+$/g, "").trim();
    if (!cleaned) throw new Error("A IA não retornou texto. Tente novamente.");
    return { text: cleaned };
  });
