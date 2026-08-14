import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Registra silenciosamente a assinatura do aparelho do usuário logado.
 * Serve para montar o grafo de contas ANTES de alguém tentar resgatar um
 * benefício — quem cria 5 contas no mesmo celular já chega marcado.
 * Nunca falha para o usuário: erro aqui não pode quebrar a navegação.
 */
export const registerMyDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => ({
    deviceId: typeof input?.deviceId === "string" ? input.deviceId.slice(0, 120) : undefined,
    attrs: typeof input?.attrs === "string" ? input.attrs.slice(0, 600) : undefined,
  }))
  .handler(async ({ data, context }) => {
    try {
      const { collectSignals, recordDevice } = await import("./fraud-engine.server");
      const sig = await collectSignals(data ?? null);
      await recordDevice(context.userId, sig);

      if (sig.deviceHash) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, signup_device_hash, email, email_canonical")
          .eq("id", context.userId)
          .maybeSingle();

        const patch: Record<string, unknown> = {};
        if (profile && !(profile as any).signup_device_hash) patch.signup_device_hash = sig.deviceHash;
        if (profile && !(profile as any).email_canonical && (profile as any).email) {
          const { canonicalEmail } = await import("./email-canonical");
          const canonical = canonicalEmail((profile as any).email);
          if (canonical) patch.email_canonical = canonical;
        }
        if (Object.keys(patch).length > 0) {
          await supabaseAdmin.from("profiles").update(patch as any).eq("id", context.userId);
        }
      }
      return { ok: true };
    } catch (e) {
      console.error("[registerMyDevice] falhou:", e);
      return { ok: false };
    }
  });
