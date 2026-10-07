import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "./admin-helpers.server";

/**
 * Procedimento "Fix Login" (sacudir registro):
 * Resolve problemas de sincronização no Yaarsa re-aplicando a senha e 
 * forçando uma atualização de expiração (+1 dia e volta).
 */
export const fixLoginInconsistency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { licenseId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lic } = await supabaseAdmin.from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic || lic.disabled_at) throw new Error("Licença inválida ou inexistente");

    // Mesma regra do "Reparar acesso" (data em Brasília, senha confirmada).
    const { healLicenseLogin } = await import("./license-heal.server");
    await healLicenseLogin(
      {
        id: lic.id, user_id: lic.user_id, plan_slug: lic.plan_slug ?? null,
        yaarsa_username: lic.yaarsa_username, yaarsa_email: lic.yaarsa_email,
        yaarsa_password_enc: lic.yaarsa_password_enc, panel: lic.panel ?? null,
        expires_at: lic.expires_at ?? null, is_trial: lic.is_trial ?? null, server_ip: lic.server_ip ?? null,
      } as any,
      { reason: "fix_login" },
    );
    return { ok: true };
  });
