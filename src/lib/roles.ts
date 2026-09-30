import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/roles.functions";
import type { Role } from "@/lib/permissions";

/**
 * Descobre o papel do usuário logado (admin > moderator > user).
 * Antes eram 3 chamadas por tela (centenas de milhares no banco); agora é
 * 1 leitura da própria linha de cargos, com cache de 60s e sem pedidos
 * duplicados quando vários componentes pedem ao mesmo tempo.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { role: Role; at: number; pending?: Promise<Role> }>();

async function loadRole(uid: string): Promise<Role> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  if (!error) {
    const roles = (data ?? []).map((r: any) => String(r.role));
    if (roles.includes("admin")) return "admin";
    // "support" enxerga as mesmas telas de atendimento que "moderator".
    if (roles.includes("moderator") || roles.includes("support")) return "moderator";
    return "user";
  }
  // Leitura falhou (permissão/cache de schema): confirma no servidor.
  try {
    const res: any = await getMyRole({});
    if (res?.role === "admin" || res?.role === "moderator") return res.role;
  } catch {
    /* mantém "user" */
  }
  return "user";
}

export async function fetchMyRole(userId?: string | null): Promise<Role> {
  let uid = userId ?? null;
  if (!uid) {
    const { data } = await supabase.auth.getSession();
    uid = data.session?.user?.id ?? null;
  }
  if (!uid) return "user";
  const hit = cache.get(uid);
  if (hit?.pending) return hit.pending;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.role;
  const pending = loadRole(uid)
    .then((role) => { cache.set(uid!, { role, at: Date.now() }); return role; })
    .catch(() => { cache.delete(uid!); return "user" as Role; });
  cache.set(uid, { role: hit?.role ?? "user", at: 0, pending });
  return pending;
}

export function clearRoleCache() { cache.clear(); }

export const isStaffRole = (r: Role | null | undefined) => r === "admin" || r === "moderator";
