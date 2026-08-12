import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAFF_ROLES = ["admin", "moderator", "support"];

class StaffAccessError extends Error {}
class StaffInfraError extends Error {}

/**
 * Resolve o papel do membro da equipe de forma resiliente.
 * Antes, qualquer falha de infraestrutura (tabela sem GRANT, cache de schema)
 * era exibida como "Acesso Restrito", mesmo para o dono da conta admin.
 * Agora separamos claramente: falta de papel (403) x falha técnica (500).
 */
async function assertStaff(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("[StaffNexus] Falha ao ler user_roles:", error.code, error.message);
    throw new StaffInfraError(
      `Falha técnica ao verificar seu cargo (${error.code || "erro"}): ${error.message}`,
    );
  }

  const list = (roles || []).map((r: any) => String(r.role));
  const role = STAFF_ROLES.find((r) => list.includes(r));
  if (!role) {
    console.warn("[StaffNexus] Acesso negado. Papéis encontrados:", list);
    throw new StaffAccessError(
      "Acesso negado: sua conta não possui cargo de admin, moderador ou suporte.",
    );
  }
  return { supabaseAdmin, role };
}

/** Garante que a tabela do canal interno responde; erro claro em vez de "acesso negado". */
function wrapChannelError(error: { code?: string; message: string }, action: string): never {
  console.error(`[StaffNexus] ${action} falhou:`, error.code, error.message);
  if (error.code === "42501") {
    throw new StaffInfraError(
      "O canal interno está sem permissão de acesso no banco (GRANT ausente em staff_messages).",
    );
  }
  if (error.code === "PGRST205" || error.code === "PGRST106") {
    throw new StaffInfraError(
      "A tabela do canal interno não está publicada na API. Recarregue em instantes.",
    );
  }
  throw new StaffInfraError(`${action} falhou: ${error.message}`);
}

export const getStaffMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ channel: z.string().default("general") }).parse(data ?? {}),
  )
  .handler(async ({ data: input, context }) => {
    const { userId } = context;
    const { supabaseAdmin, role } = await assertStaff(userId);

    const { data: rows, error } = await supabaseAdmin
      .from("staff_messages")
      .select("id, content, created_at, sender_id")
      .eq("channel", input.channel)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) wrapChannelError(error as any, "Carregar mensagens");

    const list = (rows || []).slice().reverse();
    const ids = Array.from(new Set(list.map((m: any) => m.sender_id).filter(Boolean)));

    const profileMap = new Map<string, any>();
    const roleMap = new Map<string, string>();

    if (ids.length) {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, display_name, full_name, email, avatar_url, metadata")
          .in("id", ids),
        supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      for (const p of profiles || []) profileMap.set((p as any).id, p);
      for (const r of roles || []) {
        const current = roleMap.get((r as any).user_id);
        // admin tem prioridade na exibição
        if (!current || (r as any).role === "admin") roleMap.set((r as any).user_id, (r as any).role);
      }
    }

    const messages = list.map((m: any) => {
      const p = profileMap.get(m.sender_id) || {};
      const meta = (p.metadata as any) || {};
      return {
        id: m.id,
        content: m.content,
        created_at: m.created_at,
        sender_id: m.sender_id,
        isMine: m.sender_id === userId,
        author:
          meta.nickname ||
          p.display_name ||
          p.full_name ||
          p.email?.split("@")[0] ||
          "Membro da equipe",
        avatar: meta.avatar_url || p.avatar_url || null,
        sender_role: roleMap.get(m.sender_id) || "staff",
      };
    });

    return { messages, myRole: role, myId: userId };
  });

export const sendStaffMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        content: z.string().trim().min(1).max(2000),
        channel: z.string().default("general"),
      })
      .parse(data),
  )
  .handler(async ({ data: input, context }) => {
    const { userId } = context;
    const { supabaseAdmin, role } = await assertStaff(userId);

    const { data, error } = await supabaseAdmin
      .from("staff_messages")
      .insert({
        sender_id: userId,
        content: input.content,
        channel: input.channel,
        metadata: { role },
      })
      .select("id, content, created_at, sender_id")
      .single();

    if (error) wrapChannelError(error as any, "Enviar mensagem");
    return data;
  });

export const deleteStaffMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin, role } = await assertStaff(userId);

    let q = supabaseAdmin.from("staff_messages").delete().eq("id", data.id);
    // Admin pode remover qualquer mensagem; demais só as próprias.
    if (role !== "admin") q = q.eq("sender_id", userId);

    const { error } = await q;
    if (error) wrapChannelError(error as any, "Apagar mensagem");
    return { ok: true };
  });
