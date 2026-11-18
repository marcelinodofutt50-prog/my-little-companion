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
    const now = Date.now();
    const end = new Date(now).toISOString();
    const since = new Date(now - 86400000).toISOString();
    const db: any = supabaseAdmin;

    const pageSize = 500;
    const readSales = async () => {
      let salesCount = 0;
      let salesTotal = 0;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await db.from("orders").select("amount")
          .eq("status", "paid").gte("paid_at", since).lte("paid_at", end)
          .order("id", { ascending: true }).range(offset, offset + pageSize - 1);
        if (error) throw new Error("Não foi possível consultar as vendas do dia.");
        for (const { amount } of data) {
          salesCount++;
          salesTotal += Number(amount ?? 0);
        }
        if (data.length < pageSize) return { salesCount, salesTotal };
      }
    };

    const [paid, stalled, trials, blocks, healOk, healFail, panelErr] = await Promise.all([
      readSales(),
      db.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending").is("mp_preference_id", null).gte("created_at", since),
      db.from("licenses").select("id", { count: "exact", head: true }).eq("is_trial", true).gte("created_at", since),
      db.from("trial_blocks").select("id", { count: "exact", head: true }).gte("created_at", since),
      db.from("integration_logs").select("id", { count: "exact", head: true }).eq("action", "license_heal_login").in("outcome", ["created", "recreated", "already_ok"]).gte("created_at", since),
      db.from("integration_logs").select("id", { count: "exact", head: true }).eq("action", "license_heal_login").not("outcome", "in", "(created,recreated,already_ok)").gte("created_at", since),
      db.from("integration_logs").select("id", { count: "exact", head: true }).like("source", "yaarsa%").eq("outcome", "yaarsa_fail").gte("created_at", since),
    ]);
    if ([stalled, trials, blocks, healOk, healFail, panelErr].some((result) => result.error)) {
      throw new Error("Não foi possível consultar todos os indicadores do dia.");
    }
    return {
      ...paid,
      stalledOrders: stalled.count ?? 0,
      trialsCreated: trials.count ?? 0,
      trialsBlocked: blocks.count ?? 0,
      repairsOk: healOk.count ?? 0,
      repairsFailed: healFail.count ?? 0,
      panelErrors: panelErr.count ?? 0,
      generatedAt: new Date().toISOString(),
    };
  });
