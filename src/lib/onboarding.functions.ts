import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Estado da "primeira vez" do cliente no painel.
 * Escrito com privilégio de servidor para que o wizard e o aviso de segurança
 * nunca voltem a aparecer por falha de cache/RLS no navegador.
 */
export const getAccountSetupState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [{ data: profile }, { count }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabaseAdmin
        .from("recovery_codes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("used_at", null),
    ]);

    const p = (profile ?? {}) as any;
    return {
      displayName: (p.display_name as string | null) ?? null,
      onboardingDone: Boolean(p.onboarding_completed_at),
      securityAcked: Boolean(p.security_ack_at),
      codesGeneratedAt: (p.recovery_codes_generated_at as string | null) ?? null,
      codesLeft: count ?? 0,
    };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        displayName: z.string().trim().max(40).optional(),
        answers: z.record(z.string(), z.string()).optional(),
        skipped: z.boolean().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {
      onboarding_completed_at: new Date().toISOString(),
      onboarding_answers: { ...(data.answers ?? {}), skipped: Boolean(data.skipped) },
    };
    if (data.displayName) patch.display_name = data.displayName;

    let { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", context.userId);

    // Cache de schema desatualizado / coluna ausente: grava ao menos o que dá,
    // em vez de falhar e fazer o wizard reaparecer para o cliente.
    if (error) {
      const minimal: any = { onboarding_completed_at: patch.onboarding_completed_at };
      if (patch.display_name) minimal.display_name = patch.display_name;
      const retry = await supabaseAdmin.from("profiles").update(minimal).eq("id", context.userId);
      error = retry.error;
      if (error && patch.display_name) {
        const last = await supabaseAdmin
          .from("profiles")
          .update({ display_name: patch.display_name })
          .eq("id", context.userId);
        error = last.error;
      }
    }

    if (error) return { ok: false, degraded: true, reason: error.message };
    return { ok: true };
  });

export const ackSecurityNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ security_ack_at: new Date().toISOString() })
      .eq("id", context.userId);
    return { ok: true };
  });
