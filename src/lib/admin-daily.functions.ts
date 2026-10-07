import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DailySummary = {
  salesCount: number;
  salesTotal: number;
  stalledOrders: number;
  trialsCreated: number;
  trialsBlocked: number;
  repairsOk: number;
  repairsFailed: number;
  panelErrors: number;
  generatedAt: string;
};

/** Resumo das últimas 24h para a equipe (só leitura). */
export const adminDailySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailySummary> => {
    const { assertStaffRole } = await import("@/lib/roles.server");
    await assertStaffRole(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 86400000).toISOString();
    const db: any = supabaseAdmin;

    const [paid, stalled, trials, blocks, healOk, healFail, panelErr] = await Promise.all([
      db.from("orders").select("amount").eq("status", "paid").gte("paid_at", since).range(0, 999),
      db.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending").is("mp_preference_id", null).gte("created_at", since),
      db.from("licenses").select("id", { count: "exact", head: true }).eq("is_trial", true).gte("created_at", since),
      db.from("trial_blocks").select("id", { count: "exact", head: true }).gte("created_at", since),
      db.from("integration_logs").select("id", { count: "exact", head: true }).eq("action", "license_heal_login").in("outcome", ["created", "recreated", "already_ok"]).gte("created_at", since),
      db.from("integration_logs").select("id", { count: "exact", head: true }).eq("action", "license_heal_login").not("outcome", "in", "(created,recreated,already_ok)").gte("created_at", since),
      db.from("integration_logs").select("id", { count: "exact", head: true }).like("source", "yaarsa%").eq("outcome", "yaarsa_fail").gte("created_at", since),
    ]);
    const rows = (paid.data ?? []) as { amount: number }[];
    return {
      salesCount: rows.length,
      salesTotal: rows.reduce((s, r) => s + Number(r.amount || 0), 0),
      stalledOrders: stalled.count ?? 0,
      trialsCreated: trials.count ?? 0,
      trialsBlocked: blocks.count ?? 0,
      repairsOk: healOk.count ?? 0,
      repairsFailed: healFail.count ?? 0,
      panelErrors: panelErr.count ?? 0,
      generatedAt: new Date().toISOString(),
    };
  });
