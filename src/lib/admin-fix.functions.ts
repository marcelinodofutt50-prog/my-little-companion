import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Procedimento "Fix Login" (sacudir registro):
 * Resolve problemas de sincronização no Yaarsa re-aplicando a senha e 
 * forçando uma atualização de expiração (+1 dia e volta).
 */
export const fixLoginInconsistency = createServerFn({ method: "POST" })
  .inputValidator((d: { licenseId: string }) => d)
  .handler(async ({ data }) => {
    const { data: lic } = await supabaseAdmin.from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic || lic.disabled_at) throw new Error("Licença inválida ou inexistente");

    const { yaarsaExtend, yaarsaSetPassword, decrypt } = await import("./yaarsa.server");
    const panel = (lic.panel || "v457") as any;
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    
    const original = lic.expires_at ? new Date(lic.expires_at) : null;
    const bumped = original ? new Date(original.getTime() + 86400000) : new Date(Date.now() + 86400000);

    // 1. Sacode expiração
    await yaarsaExtend(lic.yaarsa_email, ymd(bumped), panel);
    
    // 2. Re-aplica senha
    const plain = decrypt(lic.yaarsa_password_enc);
    await yaarsaSetPassword(lic.yaarsa_email, plain, panel, lic.yaarsa_username);

    // 3. Restaura expiração original
    if (original) {
      await yaarsaExtend(lic.yaarsa_email, ymd(original), panel);
    }

    await supabaseAdmin.from("integration_logs").insert({
      source: "manual-fix",
      action: "fix_login",
      outcome: "success",
      context: { license_id: lic.id, email: lic.yaarsa_email }
    } as any);

    return { ok: true };
  });
