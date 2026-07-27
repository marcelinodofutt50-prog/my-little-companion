import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Janela em que o cliente pode pedir reembolso (a partir do pagamento).
export const REFUND_WINDOW_DAYS = 7;
// Prazo que o time tem para analisar o pedido.
export const REFUND_REVIEW_DAYS = 2;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export const getRefundOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: orders } = await supabase
      .from("orders")
      .select("id,plan_slug,amount,status,paid_at,created_at")
      .eq("user_id", userId)
      .eq("status", "paid")
      .gte("paid_at", daysAgo(REFUND_WINDOW_DAYS))
      .order("paid_at", { ascending: false })
      .limit(20);

    const { data: requests } = await supabase
      .from("refund_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const list = (requests ?? []) as any[];
    const blockedOrderIds = new Set(
      list.filter((r) => r.status !== "rejected" && r.status !== "cancelled").map((r) => r.order_id),
    );

    const eligible = ((orders ?? []) as any[])
      .filter((o) => !blockedOrderIds.has(o.id))
      .map((o) => {
        const paid = new Date(o.paid_at ?? o.created_at).getTime();
        const deadline = paid + REFUND_WINDOW_DAYS * 86400000;
        return {
          id: o.id,
          plan_slug: o.plan_slug,
          amount: Number(o.amount),
          paid_at: o.paid_at ?? o.created_at,
          deadline_at: new Date(deadline).toISOString(),
          days_left: Math.max(0, Math.ceil((deadline - Date.now()) / 86400000)),
        };
      });

    return {
      eligible,
      requests: list,
      windowDays: REFUND_WINDOW_DAYS,
      reviewDays: REFUND_REVIEW_DAYS,
    };
  });

export const requestRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: z.string().trim().min(10).max(1000),
        pixKey: z.string().trim().max(160).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order } = await supabase
      .from("orders")
      .select("id,user_id,amount,status,paid_at,created_at")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!order) throw new Error("Pedido não encontrado.");
    if ((order as any).status !== "paid") throw new Error("Só pedidos pagos podem ser reembolsados.");

    const paid = new Date((order as any).paid_at ?? (order as any).created_at).getTime();
    if (Date.now() - paid > REFUND_WINDOW_DAYS * 86400000) {
      throw new Error(`O prazo de ${REFUND_WINDOW_DAYS} dias para solicitar reembolso já expirou.`);
    }

    const { data: existing } = await supabase
      .from("refund_requests")
      .select("id,status")
      .eq("user_id", userId)
      .eq("order_id", data.orderId)
      .limit(10);

    if ((existing ?? []).some((r: any) => r.status !== "rejected" && r.status !== "cancelled")) {
      throw new Error("Já existe um pedido de reembolso em andamento para esta compra.");
    }

    const deadline = new Date(Date.now() + REFUND_REVIEW_DAYS * 86400000).toISOString();

    const { data: inserted, error } = await supabase
      .from("refund_requests")
      .insert({
        user_id: userId,
        order_id: data.orderId,
        amount: Number((order as any).amount),
        reason: data.reason,
        pix_key: data.pixKey || null,
        status: "requested",
        deadline_at: deadline,
      } as any)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return inserted;
  });

// -------- Admin --------
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminListRefunds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("refund_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    const list = (rows ?? []) as any[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    let emails: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id,email").in("id", ids);
      emails = Object.fromEntries(((profs ?? []) as any[]).map((p) => [p.id, p.email]));
    }
    return list.map((r) => ({ ...r, user_email: emails[r.user_id] ?? null }));
  });

export const adminUpdateRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["requested", "approved", "refunded", "rejected"]),
        adminNotes: z.string().trim().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { status: data.status };
    if (data.adminNotes !== undefined) patch.admin_notes = data.adminNotes;
    if (data.status !== "requested") {
      patch.processed_at = new Date().toISOString();
      patch.processed_by = context.userId;
    }
    const { error } = await supabaseAdmin.from("refund_requests").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
