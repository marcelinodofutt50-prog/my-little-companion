import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/permissions";

/**
 * Descobre o papel do usuário logado (admin > moderator > user).
 * Usado para liberar o painel de atendimento para o time de Suporte.
 */
export async function fetchMyRole(userId?: string | null): Promise<Role> {
  let uid = userId ?? null;
  if (!uid) {
    const { data } = await supabase.auth.getUser();
    uid = data.user?.id ?? null;
  }
  if (!uid) return "user";
  const [admin, mod] = await Promise.all([
    supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: uid, _role: "moderator" }),
  ]);
  if (admin.data) return "admin";
  if (mod.data) return "moderator";
  return "user";
}

export const isStaffRole = (r: Role | null | undefined) => r === "admin" || r === "moderator";
