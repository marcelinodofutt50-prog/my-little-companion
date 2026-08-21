import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Papel do usuário logado resolvido no servidor (com fallback quando a RPC
 * `has_role` não está disponível para o client autenticado).
 */
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveRoles } = await import("@/lib/roles.server");
    const { isAdmin, isModerator, isSupport } = await resolveRoles(context);
    // "support" tem as mesmas telas de atendimento que "moderator".
    return { role: isAdmin ? "admin" : isModerator || isSupport ? "moderator" : "user" };
  });
