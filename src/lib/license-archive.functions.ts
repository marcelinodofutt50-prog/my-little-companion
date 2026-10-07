import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * O cliente esconde do painel um login que não pode mais ser usado
 * (cancelado, desativado por atraso no servidor ou vencido há mais de 1 dia).
 * Nada é apagado: o registro continua no banco para o suporte e auditoria.
 */
export const setMyLicenseHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ licenseId: z.string().uuid(), hidden: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: lic } = await context.supabase
      .from("licenses")
      .select("id, user_id, revoked, disabled_at, expires_at, suspended_at, is_trial")
      .eq("id", data.licenseId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!lic) return { ok: false, error: "Licença não encontrada." };
    const l = lic as any;
    const expiredLongAgo = !!l.expires_at && new Date(l.expires_at).getTime() < Date.now() - 86400000;
    const dead = !!l.revoked || !!l.disabled_at || (expiredLongAgo && !l.suspended_at);
    if (data.hidden && !dead) {
      return { ok: false, error: "Só dá para remover logins que já foram desativados ou venceram." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("licenses")
      .update({ hidden_by_user_at: data.hidden ? new Date().toISOString() : null } as any)
      .eq("id", data.licenseId)
      .eq("user_id", context.userId);
    if (error) return { ok: false, error: "Não foi possível atualizar agora. Tente de novo." };
    return { ok: true };
  });

/** Um login é "morto" (pode ser removido do painel) — mesma regra do servidor. */
export function isDeadLicense(l: any, now = Date.now()): boolean {
  const expiredLongAgo = !!l?.expires_at && new Date(l.expires_at).getTime() < now - 86400000;
  return !!l?.revoked || !!l?.disabled_at || (expiredLongAgo && !l?.suspended_at);
}
