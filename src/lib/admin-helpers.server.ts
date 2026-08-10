/** Helpers server-only do painel admin. Mantidos fora de admin.functions.ts
 *  porque o bundler remove qualquer código irmão das server functions. */

export async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { assertAdminRole } = await import("@/lib/roles.server");
  await assertAdminRole(ctx);
}

/** Admin OU moderador (Suporte). Usado nas áreas de atendimento. */
export async function assertStaff(ctx: { supabase: any; userId: string }) {
  const { assertStaffRole } = await import("@/lib/roles.server");
  await assertStaffRole(ctx);
}

export async function resolveOrInviteUser(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("profiles").select("id, email").eq("email", email).maybeSingle();
  if (existing) return { userId: existing.id, invited: false };
  const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
  if (error || !invited?.user) throw new Error(`Falha ao convidar ${email}: ${error?.message || "sem retorno"}`);
  return { userId: invited.user.id, invited: true };
}
