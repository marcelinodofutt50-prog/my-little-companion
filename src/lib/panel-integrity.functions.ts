import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Roda a conferência painel ↔ site sob demanda (aba "Integridade dos logins"). */
export const staffAuditPanelIntegrity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).optional(),
        autoRepair: z.boolean().optional(),
        licenseIds: z.array(z.string().uuid()).max(50).optional(),
        userId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/admin-helpers.server");
    await assertStaff(context);
    const { auditPanelIntegrity } = await import("@/lib/panel-integrity.server");
    try {
      const report = await auditPanelIntegrity({
        ...(data.limit !== undefined ? { limit: data.limit } : {}),
        autoRepair: data.autoRepair ?? true,
        ...(data.licenseIds ? { licenseIds: data.licenseIds } : {}),
        ...(data.userId ? { userId: data.userId } : {}),
      });
      return { ok: true as const, report };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : "Falha na conferência." };
    }
  });

/** Últimos problemas detectados (sem bater no painel de novo). */
export const staffPanelIntegrityHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/admin-helpers.server");
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integration_logs")
      .select("id, created_at, action, outcome, error, context")
      .eq("source", "panel-integrity")
      .order("created_at", { ascending: false })
      .limit(60);
    return { ok: true as const, events: data ?? [] };
  });
