import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyOrder = {
  id: string;
  plan_slug: string;
  plan_name: string | null;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  processing_at: string | null;
  delivered_at: string | null;
  is_gift: boolean;
  gift_to: string | null;
  stage: "pending" | "paid" | "processing" | "delivered" | "failed" | "refunded";
};

function stageOf(status: string, delivered: boolean): MyOrder["stage"] {
  if (status === "refunded") return "refunded";
  if (status === "yaarsa_failed" || status === "failed" || status === "cancelled") return "failed";
  if (delivered) return "delivered";
  if (status === "processing") return "processing";
  if (status === "paid") return "paid";
  return "pending";
}

/** Lista os pedidos do usuário logado com o estágio real da entrega. */
export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ metadata: z.record(z.string(), z.any()).optional() }).optional().parse(d))
  .handler(async ({ data: input, context }): Promise<MyOrder[]> => {
    const userId = context.userId;
    const metadata = (input as any)?.metadata || {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const fetchAll = async (client: any) => Promise.all([
      client.from("orders").select("id, plan_slug, amount, status, created_at, paid_at, processing_at, metadata").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      client.from("licenses").select("order_id, created_at").eq("user_id", userId),
      client.from("plans").select("slug, name"),
    ]);

    let results = await fetchAll(context.supabase);
    let hasError = results.some(r => r.error);

    if (hasError) {
      const pgrstError = results.find(r => r.error && (r.error.code === 'PGRST108' || r.error.message?.includes('schema cache')))?.error;
      if (pgrstError) {
        const { trackSchemaFailure } = await import("./tutorials.functions");
        await trackSchemaFailure(pgrstError, "listMyOrders", false, metadata, userId);
        results = await fetchAll(supabaseAdmin);
        if (!results.some(r => r.error)) {
          await trackSchemaFailure(pgrstError, "listMyOrders", true, { stage: "retry_success" }, userId);
        }
      }
    }

    const [{ data: orders }, { data: licenses }, { data: plans }] = results;

    const licByOrder = new Map<string, string>();
    for (const l of (licenses ?? []) as any[]) {
      if (l.order_id && !licByOrder.has(l.order_id)) licByOrder.set(l.order_id, l.created_at);
    }
    const planName = new Map<string, string>();
    for (const p of (plans ?? []) as any[]) planName.set(p.slug, p.name);

    return ((orders ?? []) as any[]).map((o) => {
      const deliveredAt = licByOrder.get(o.id) ?? null;
      const meta = (o.metadata ?? {}) as any;
      return {
        id: o.id,
        plan_slug: o.plan_slug,
        plan_name: planName.get(o.plan_slug) ?? null,
        amount: Number(o.amount ?? 0),
        status: o.status,
        created_at: o.created_at,
        paid_at: o.paid_at ?? null,
        processing_at: o.processing_at ?? null,
        delivered_at: deliveredAt,
        is_gift: !!meta?.gift,
        gift_to: meta?.gift?.to_email ?? meta?.gift?.email ?? null,
        stage: stageOf(o.status, !!deliveredAt),
      } satisfies MyOrder;
    });
  });
