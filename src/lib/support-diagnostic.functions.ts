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

    const { healLicenseLogin } = await import("./license-heal.server");
    return healLicenseLogin(
      {
        id: lic.id,
        user_id: context.userId,
        plan_slug: lic.plan_slug ?? null,
        yaarsa_username: lic.yaarsa_username,
        yaarsa_email: lic.yaarsa_email,
        yaarsa_password_enc: lic.yaarsa_password_enc,
        panel: lic.panel ?? null,
        expires_at: lic.expires_at ?? null,
        is_trial: lic.is_trial ?? null,
        server_ip: lic.server_ip ?? null,
      },
      { reason: "cliente_suporte_corrigir_login" },
    );
  });
