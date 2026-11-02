/**
 * Resolução de papéis no servidor.
 *
 * As verificações de uso comum usam uma única RPC (is_staff ou has_role).
 * O fallback administrativo só é consultado quando a RPC falha de verdade;
 * uma resposta false é uma decisão válida de autorização, não um erro.
 */
export type StaffRole = "admin" | "moderator" | "support";

const MFA_REQUIRED_MESSAGE =
  "Confirme a verificação em duas etapas da sua conta antes de continuar.";

type RpcResult = { ok: boolean; value: boolean };

async function rpcHasRole(userClient: any, userId: string, role: StaffRole): Promise<RpcResult> {
  try {
    const { data, error } = await userClient.rpc("has_role", { _user_id: userId, _role: role });
    if (error) return { ok: false, value: false };
    return { ok: true, value: Boolean(data) };
  } catch {
    return { ok: false, value: false };
  }
}

async function rpcIsStaff(userClient: any, userId: string): Promise<RpcResult> {
  try {
    const { data, error } = await userClient.rpc("is_staff", { _user_id: userId });
    if (error) return { ok: false, value: false };
    return { ok: true, value: Boolean(data) };
  } catch {
    return { ok: false, value: false };
  }
}

async function rpcMfaSatisfied(userClient: any): Promise<RpcResult> {
  try {
    const { data, error } = await userClient.rpc("mfa_satisfied");
    if (error) return { ok: false, value: false };
    return { ok: true, value: Boolean(data) };
  } catch {
    return { ok: false, value: false };
  }
}

async function requireMfa(userClient: any): Promise<void> {
  const mfa = await rpcMfaSatisfied(userClient);
  if (!mfa.ok || !mfa.value) throw new Error(MFA_REQUIRED_MESSAGE);
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

/** Papéis efetivos do usuário. Mantido para consumidores que precisam dos três papéis. */
export async function resolveRoles(ctx: { supabase: any; userId: string }) {
  const [a, m, s] = await Promise.all([
    rpcHasRole(ctx.supabase, ctx.userId, "admin"),
    rpcHasRole(ctx.supabase, ctx.userId, "moderator"),
    rpcHasRole(ctx.supabase, ctx.userId, "support"),
  ]);

  let isAdmin = a.value;
  let isModerator = m.value;
  let isSupport = s.value;

  // false é uma resposta válida. Só usamos o fallback quando alguma RPC falhou.
  if (!a.ok || !m.ok || !s.ok) {
    const mfa = await rpcMfaSatisfied(ctx.supabase);
    // Nunca permita que o fallback de service role contorne a exigência de MFA.
    if (!mfa.ok || !mfa.value) {
      return { isAdmin: false, isModerator: false, isSupport: false, isStaff: false };
    }

    const roles = await readRolesViaAdmin(ctx.userId);
    isAdmin = isAdmin || roles.has("admin");
    isModerator = isModerator || roles.has("moderator");
    isSupport = isSupport || roles.has("support");
  }

  return { isAdmin, isModerator, isSupport, isStaff: isAdmin || isModerator || isSupport };
}

export async function assertAdminRole(ctx: { supabase: any; userId: string }) {
  const result = await rpcHasRole(ctx.supabase, ctx.userId, "admin");

  if (result.ok && result.value) return;

  // has_role já aplica MFA. Reconsultamos apenas no caminho negativo/erro
  // para distinguir falta de permissão de uma verificação MFA pendente.
  await requireMfa(ctx.supabase);

  if (result.ok) throw new Error("Forbidden");

  // Compatibilidade temporária se a RPC estiver indisponível; só após MFA.
  const roles = await readRolesViaAdmin(ctx.userId);
  if (!roles.has("admin")) throw new Error("Forbidden");
}

export async function assertStaffRole(ctx: { supabase: any; userId: string }) {
  const result = await rpcIsStaff(ctx.supabase, ctx.userId);

  if (result.ok) {
    if (!result.value) throw new Error("Forbidden");
    return;
  }

  // Fallback apenas para indisponibilidade real da RPC e sempre após MFA.
  await requireMfa(ctx.supabase);
  const roles = await readRolesViaAdmin(ctx.userId);
  if (!roles.has("admin") && !roles.has("moderator") && !roles.has("support")) {
    throw new Error("Forbidden");
  }
}
