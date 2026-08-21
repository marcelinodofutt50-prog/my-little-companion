import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/roles.functions";
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
  const [admin, mod, support] = await Promise.all([
    supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: uid, _role: "moderator" }),
    supabase.rpc("has_role", { _user_id: uid, _role: "support" }),
  ]);
  if (admin.data) return "admin";
  // "support" enxerga as mesmas telas de atendimento que "moderator".
  if (mod.data || support.data) return "moderator";

  // Se a RPC falhou (permissão de EXECUTE ausente / cache de schema), o
  // Suporte ficava sem as abas de atendimento. Confirmamos no servidor.
  if (admin.error || mod.error || support.error) {
    try {
      const res: any = await getMyRole({});
      if (res?.role === "admin" || res?.role === "moderator") return res.role;
    } catch {
      /* mantém "user" */
    }
  }
  return "user";
}

export const isStaffRole = (r: Role | null | undefined) => r === "admin" || r === "moderator";
