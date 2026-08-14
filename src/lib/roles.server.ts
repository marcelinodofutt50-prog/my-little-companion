/**
 * Resolução de papéis no servidor, à prova de falha.
 *
 * A checagem preferida é a RPC `has_role` (SECURITY DEFINER). Em alguns
 * ambientes a RPC pode falhar por permissão de EXECUTE ausente ou cache de
 * schema desatualizado — nesse caso o painel de atendimento simplesmente
 * "sumia" para o Suporte. Aqui, se a RPC der erro (não apenas false),
 * confirmamos o papel lendo `user_roles` com o client de serviço.
 *
 * Importante: isso NÃO afrouxa a segurança — o papel continua vindo do banco.
 */
export type StaffRole = "admin" | "moderator" | "support";

async function rpcHasRole(userClient: any, userId: string, role: StaffRole) {
  try {
    const { data, error } = await userClient.rpc("has_role", { _user_id: userId, _role: role });
    if (error) return { ok: false, value: false };
    return { ok: true, value: Boolean(data) };
  } catch {
    return { ok: false, value: false };
  }
}

async function readRolesViaAdmin(userId: string): Promise<Set<string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((r: any) => String(r.role)));
  } catch (e) {
    console.warn("[roles.server] fallback user_roles indisponível:", (e as Error)?.message);
    return new Set<string>();
  }
}

/** Papéis efetivos do usuário (com fallback). */
export async function resolveRoles(ctx: { supabase: any; userId: string }) {
  const [a, m, s] = await Promise.all([
    rpcHasRole(ctx.supabase, ctx.userId, "admin"),
    rpcHasRole(ctx.supabase, ctx.userId, "moderator"),
    rpcHasRole(ctx.supabase, ctx.userId, "support"),
  ]);

  let isAdmin = a.value;
  let isModerator = m.value;
  let isSupport = s.value;

  // Se qualquer RPC falhou (erro, não "false"), confirmamos pelo banco.
  if (!a.ok || !m.ok || !s.ok) {
    const roles = await readRolesViaAdmin(ctx.userId);
    isAdmin = isAdmin || roles.has("admin");
    isModerator = isModerator || roles.has("moderator");
    isSupport = isSupport || roles.has("support");
  }

  return { isAdmin, isModerator, isSupport, isStaff: isAdmin || isModerator || isSupport };
}

export async function assertAdminRole(ctx: { supabase: any; userId: string }) {
  const { isAdmin } = await resolveRoles(ctx);
  if (!isAdmin) throw new Error("Forbidden");
}

export async function assertStaffRole(ctx: { supabase: any; userId: string }) {
  const { isStaff } = await resolveRoles(ctx);
  if (!isStaff) throw new Error("Forbidden");
}
