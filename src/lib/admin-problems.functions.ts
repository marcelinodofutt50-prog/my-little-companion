import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminProblem = {
  kind: "paid_no_license" | "yaarsa_failed" | "stuck_apk" | "open_thread" | "pending_refund" | "old_pending_order";
  id: string;
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  createdAt: string;
  userId?: string;
  userEmail?: string;
  link?: string;
};

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

/**
 * Returns actionable problems that require admin attention:
 * - paid orders without a license for login plans
 * - orders stuck in yaarsa_failed
 * - APK jobs stuck in pending for too long
 * - open support threads
 * - pending refund requests
 * - pending orders older than 1 hour
 */
export const getAdminProblems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminProblem[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const problems: AdminProblem[] = [];

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // 1) Paid orders without a license for login/upgrade plan categories
    const { data: plans } = await supabaseAdmin.from("plans").select("slug, category");
    const planCategory = new Map<string, string>(((plans ?? []) as any[]).map((p) => [p.slug, p.category]));
    const { data: paidOrders } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, plan_slug, amount, paid_at, status, created_at")
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(200);
    const orderIds = ((paidOrders ?? []) as any[])
      .filter((o) => ["login", "upgrade"].includes(planCategory.get(o.plan_slug) ?? ""))
      .map((o) => o.id);
    if (orderIds.length) {
      const { data: licenses } = await supabaseAdmin
        .from("licenses")
        .select("order_id")
        .in("order_id", orderIds);
      const delivered = new Set(((licenses ?? []) as any[]).map((l) => l.order_id));
      for (const o of (paidOrders ?? []) as any[]) {
        if (!delivered.has(o.id) && ["login", "upgrade"].includes(planCategory.get(o.plan_slug) ?? "")) {
          problems.push({
            kind: "paid_no_license",
            id: o.id,
            title: "Pedido pago sem entrega",
            detail: `Pedido ${o.id.slice(0, 8)} — ${o.plan_slug} — R$ ${o.amount}`,
            severity: "critical",
            createdAt: o.paid_at ?? o.created_at,
            userId: o.user_id,
            link: `/admin?tab=orders`,
          });
        }
      }
    }


    // 2) Orders in yaarsa_failed (Yaarsa creation/renewal failed)
    const { data: failedOrders } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, plan_slug, amount, updated_at, status")
      .eq("status", "yaarsa_failed")
      .order("updated_at", { ascending: false })
      .limit(50);
    for (const o of (failedOrders ?? []) as any[]) {
      problems.push({
        kind: "yaarsa_failed",
        id: o.id,
        title: "Falha na entrega (Yaarsa)",
        detail: `Pedido ${o.id.slice(0, 8)} — ${o.plan_slug} — R$ ${o.amount}`,
        severity: "critical",
        createdAt: o.updated_at,
        userId: o.user_id,
        link: `/admin?tab=orders`,
      });
    }

    // 3) Old pending orders (>1h) — likely webhook missed or stuck
    const { data: oldPending } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, plan_slug, amount, created_at, status")
      .in("status", ["pending", "created"])
      .lt("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(50);
    for (const o of (oldPending ?? []) as any[]) {
      problems.push({
        kind: "old_pending_order",
        id: o.id,
        title: "Pedido pendente antigo",
        detail: `Pedido ${o.id.slice(0, 8)} — ${o.plan_slug} — R$ ${o.amount}`,
        severity: "warning",
        createdAt: o.created_at,
        userId: o.user_id,
        link: `/admin?tab=orders`,
      });
    }

    // 4) Stuck APK jobs (queued/claimed/sending/processing for >30 min)
    const stuckCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stuckJobs } = await supabaseAdmin
      .from("apk_jobs")
      .select("id, user_id, status, created_at, source_filename")
      .in("status", ["queued", "claimed", "sending", "processing"])
      .lt("created_at", stuckCutoff)
      .is("cleared_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    for (const j of (stuckJobs ?? []) as any[]) {
      problems.push({
        kind: "stuck_apk",
        id: j.id,
        title: "APK travado na fila",
        detail: `Job ${j.id.slice(0, 8)} — ${j.status}${j.source_filename ? ` — ${j.source_filename}` : ""}`,
        severity: "warning",
        createdAt: j.created_at,
        userId: j.user_id,
        link: `/admin?tab=apk`,
      });
    }

    // 5) Open support threads
    const { data: openThreads } = await supabaseAdmin
      .from("support_threads")
      .select("id, user_id, subject, priority, created_at, unread_by_staff")
      .neq("status", "closed")
      .order("last_customer_message_at", { ascending: false })
      .limit(100);
    for (const t of (openThreads ?? []) as any[]) {
      problems.push({
        kind: "open_thread",
        id: t.id,
        title: "Ticket aberto",
        detail: `${t.subject || "Sem assunto"}${t.unread_by_staff ? ` — ${t.unread_by_staff} não lido(s)` : ""}`,
        severity: t.priority === "high" ? "critical" : "info",
        createdAt: t.created_at,
        userId: t.user_id,
        link: `/admin?tab=chat`,
      });
    }

    // 6) Pending refund requests
    const { data: pendingRefunds } = await supabaseAdmin
      .from("refund_requests")
      .select("id, user_id, amount, created_at, order_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    for (const r of (pendingRefunds ?? []) as any[]) {
      problems.push({
        kind: "pending_refund",
        id: r.id,
        title: "Reembolso pendente",
        detail: `Pedido ${r.order_id?.slice(0, 8) ?? "—"} — R$ ${r.amount}`,
        severity: "warning",
        createdAt: r.created_at,
        userId: r.user_id,
        link: `/admin?tab=refunds`,
      });
    }

    // Resolve user emails for display
    const userIds = Array.from(new Set(problems.map((p) => p.userId).filter(Boolean))) as string[];
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id,email")
        .in("id", userIds);

      const map = Object.fromEntries(((profiles ?? []) as any[]).map((p) => [p.id, p.email]));
      for (const p of problems) {
        if (p.userId) p.userEmail = map[p.userId] ?? undefined;
      }
    }

    return problems.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

/**
 * Compact daily report: revenue, new users, active licenses, pending refunds, pending APK jobs.
 */
export const getAdminDailyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: paid24h },
      { count: newUsers },
      { count: activeLicenses },
      { count: pendingRefunds },
      { count: pendingApk },
    ] = await Promise.all([
      supabaseAdmin.from("orders").select("amount").eq("status", "paid").gte("paid_at", since),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("licenses").select("*", { count: "exact", head: true }).eq("revoked", false).is("disabled_at", null),
      supabaseAdmin.from("refund_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("apk_jobs").select("*", { count: "exact", head: true }).in("status", ["queued", "claimed", "sending", "processing"]).is("cleared_at", null),
    ]);

    const revenue = ((paid24h ?? []) as any[]).reduce((s, r) => s + Number(r.amount), 0);

    return {
      revenue,
      newUsers: newUsers ?? 0,
      activeLicenses: activeLicenses ?? 0,
      pendingRefunds: pendingRefunds ?? 0,
      pendingApk: pendingApk ?? 0,
    };
  });
