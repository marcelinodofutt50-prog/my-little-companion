import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/admin-helpers.server";

/**
 * Vendas externas (Cakto/Gangstar/fora do site) registradas manualmente.
 * Somam no "Gasto total" do cliente (ver adminCustomer360), sem criar pedido
 * em public.orders — evitando os triggers/provisionamento de orders.
 * Todas as operações exigem staff e usam service role.
 */

export const adminAddManualSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        amount: z.number().positive().max(1_000_000),
        label: z.string().trim().min(1).max(120),
        source: z.string().trim().max(40).optional().nullable(),
        note: z.string().trim().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("manual_sales").insert({
      user_id: data.userId,
      amount: data.amount,
      label: data.label.trim(),
      source: (data.source?.trim() || "externo").slice(0, 40),
      note: data.note?.trim() || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListManualSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("manual_sales")
      .select("id, amount, label, source, note, created_at, created_by")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminDeleteManualSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("manual_sales").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
