const STAFF_ROLES = ["admin", "moderator", "support"];

export class StaffAccessError extends Error {}
export class StaffInfraError extends Error {}

export async function assertStaffChannelAccess(userId: string, fallbackClient?: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  // Se a chave de serviço estiver indisponível em produção, lemos os cargos
  // com o próprio usuário (a política já libera a leitura do próprio cargo).
  if (error && fallbackClient) {
    const retry = await fallbackClient.from("user_roles").select("role").eq("user_id", userId);
    if (!retry.error) {
      roles = retry.data;
      error = null as any;
    }
  }

  if (error) {
    console.error("[StaffNexus] Falha ao ler user_roles:", error.code, error.message);
    throw new StaffInfraError("Falha técnica ao verificar seu cargo. Tente novamente em instantes.");
  }

  const list = (roles ?? []).map((row) => String(row.role));
  const role = STAFF_ROLES.find((candidate) => list.includes(candidate));
  if (!role) {
    throw new StaffAccessError(
      "Acesso negado: sua conta não possui cargo de admin, moderador ou suporte.",
    );
  }
  return { supabaseAdmin, role };
}

export function throwStaffChannelError(
  error: { code?: string; message: string },
  action: string,
): never {
  console.error(`[StaffNexus] ${action} falhou:`, error.code, error.message);
  if (error.code === "42501") {
    throw new StaffInfraError("O canal interno está temporariamente sem permissão de acesso.");
  }
  if (error.code === "PGRST205" || error.code === "PGRST106") {
    throw new StaffInfraError("O canal interno está sincronizando com o banco. Tente novamente em instantes.");
  }
  throw new StaffInfraError(`${action} falhou. Tente novamente.`);
}
/** Canal privado entre dois membros da equipe: dm:<idA>|<idB> (ordenado). */
export function dmChannelFor(a: string, b: string): string {
  return `dm:${[a, b].sort().join("|")}`;
}

export function isDmChannel(channel: string): boolean {
  return channel.startsWith("dm:");
}

/** Garante que o usuário faz parte do canal privado que está tentando abrir. */
export function assertChannelMembership(channel: string, userId: string): void {
  if (!isDmChannel(channel)) return;
  const parts = channel.slice(3).split("|");
  if (parts.length !== 2 || !parts.includes(userId)) {
    throw new StaffAccessError("Você não faz parte desta conversa privada.");
  }
}
