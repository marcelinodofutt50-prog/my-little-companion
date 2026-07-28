import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "migration-proofs";

const payload = z.object({
  currentPanel: z.string().trim().min(2, "Informe o painel/servidor atual").max(120),
  panelVersion: z.string().trim().max(40).optional().or(z.literal("")),
  oldUsername: z.string().trim().min(2, "Informe seu usuário no painel antigo").max(120),
  clientsCount: z.coerce.number().int().min(0).max(100000),
  oldExpiresOn: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  proofPaths: z.array(z.string().trim().min(1).max(400)).max(6).default([]),
});

/** Última solicitação de migração do usuário (ou null). */
export const getMyMigrationRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("migration_requests")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

/** Cria a solicitação de migração com o checklist preenchido e os comprovantes. */
export const submitMigrationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => payload.parse(i))
  .handler(async ({ data, context }) => {
    if (data.proofPaths.length === 0) {
      throw new Error("Anexe pelo menos 1 comprovante de que você já usa outro servidor.");
    }
    // Só aceita arquivos dentro da pasta do próprio usuário.
    const bad = data.proofPaths.find((p) => !p.startsWith(`${context.userId}/`));
    if (bad) throw new Error("Anexo inválido. Reenvie os arquivos e tente de novo.");

    const { data: row, error } = await context.supabase
      .from("migration_requests")
      .insert({
        user_id: context.userId,
        current_panel: data.currentPanel,
        panel_version: data.panelVersion || null,
        old_username: data.oldUsername,
        clients_count: data.clientsCount,
        old_expires_on: data.oldExpiresOn ? data.oldExpiresOn : null,
        notes: data.notes || null,
        proof_paths: data.proofPaths,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new Error(`Não foi possível enviar sua solicitação: ${error.message}`);

    // Abre (ou reaproveita) um ticket de suporte e registra o pedido no chat.
    try {
      const { data: thread } = await context.supabase
        .from("support_threads")
        .select("id")
        .eq("user_id", context.userId)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let threadId = (thread as any)?.id as string | undefined;
      if (!threadId) {
        const { data: created } = await context.supabase
          .from("support_threads")
          .insert({ user_id: context.userId, subject: "Programa de migração", status: "open" })
          .select("id")
          .single();
        threadId = (created as any)?.id;
      }

      if (threadId) {
        await context.supabase.from("support_messages").insert({
          thread_id: threadId,
          sender_id: context.userId,
          body:
            `📦 Solicitação de migração enviada\n` +
            `• Painel atual: ${data.currentPanel}${data.panelVersion ? ` (v${data.panelVersion})` : ""}\n` +
            `• Usuário antigo: ${data.oldUsername}\n` +
            `• Clientes ativos: ${data.clientsCount}\n` +
            `• Vence no servidor antigo: ${data.oldExpiresOn || "não informado"}\n` +
            `• Comprovantes anexados: ${data.proofPaths.length}\n` +
            (data.notes ? `• Observações: ${data.notes}` : ""),
        });
      }
    } catch {
      // O ticket é um extra: se falhar, a solicitação já está registrada.
    }

    return row;
  });

/** Links temporários para o admin/usuário visualizar os comprovantes. */
export const getMigrationProofUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ paths: z.array(z.string().min(1).max(400)).max(6) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const out: { path: string; url: string | null }[] = [];
    for (const path of data.paths) {
      const { data: signed } = await context.supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60);
      out.push({ path, url: signed?.signedUrl ?? null });
    }
    return out;
  });
