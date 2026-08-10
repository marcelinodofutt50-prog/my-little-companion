import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Procedimento manual de diagnóstico e correção de login.
 * A IA de suporte e o botão "Corrigir Erro" do chat usam isso para sincronizar 
 * o banco do site com os painéis VPS (Yaarsa).
 */
export const fixAccountLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: any) => z.object({ licenseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lic, error: lErr } = await supabaseAdmin
      .from("licenses")
      .select("*")
      .eq("id", data.licenseId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (lErr || !lic) throw new Error("Licença não encontrada ou acesso negado");
    if (lic.revoked || lic.disabled_at) throw new Error("Esta licença não está mais ativa.");

    const { yaarsaSetPassword, decrypt } = await import("./yaarsa.server");
    const panel = (lic.panel || "v457") as any;
    
    // Decrypt the original password and re-apply it to the panel.
    // This solves 90% of "Login Incorreto" issues where the panel is out of sync.
    const plain = decrypt(lic.yaarsa_password_enc);
    
    await yaarsaSetPassword(lic.yaarsa_email, plain, panel, lic.yaarsa_username);

    // Record the fix action
    await supabaseAdmin.from("integration_logs").insert({
      source: "support-diagnostic",
      action: "fix_login_sync",
      outcome: "success",
      context: { license_id: lic.id, email: lic.yaarsa_email }
    } as any);

    return { 
      ok: true, 
      message: "O registro do seu login foi reiniciado e sincronizado com sucesso. Tente entrar novamente." 
    };
  });
