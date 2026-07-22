import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Minimum a user can request in a single payout.
const MIN_PAYOUT = 50;

async function computeBalances(supabase: any, userId: string) {
  // Earned: granted/paid referrals of pix or cashback type.
  const { data: refs } = await supabase
    .from("referrals")
    .select("reward_type,reward_status,reward_amount")
    .eq("referrer_id", userId);
  const earned = (refs ?? [])
    .filter((r: any) => r.reward_status !== "pending" && (r.reward_type === "pix" || r.reward_type === "cashback"))
    .reduce((s: number, r: any) => s + Number(r.reward_amount), 0);

  // Reserved: everything not rejected still counts against the balance.
  const { data: reqs } = await supabase
    .from("payout_requests")
    .select("amount,status")
    .eq("user_id", userId);
  const reserved = (reqs ?? [])
    .filter((r: any) => r.status !== "rejected")
    .reduce((s: number, r: any) => s + Number(r.amount), 0);

  const available = Math.max(0, earned - reserved);
  return { earned, reserved, available };
}

export const getPayoutOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const balances = await computeBalances(supabase, userId);

    const { data: profile } = await supabase
      .from("profiles").select("pix_key,referral_reward_pref").eq("id", userId).maybeSingle();

    const { data: history } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    return {
      balances,
      pixKey: (profile?.pix_key as string) ?? null,
      pref: (profile?.referral_reward_pref as "cashback" | "free_month" | "pix") ?? "cashback",
      history: history ?? [],
      minPayout: MIN_PAYOUT,
    };
  });

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      method: z.enum(["pix", "cashback"]),
      amount: z.number().positive().max(100000),
      pixKey: z.string().trim().max(160).optional().nullable(),
      note: z.string().trim().max(500).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.amount < MIN_PAYOUT) throw new Error(`Valor mínimo de resgate: R$ ${MIN_PAYOUT.toFixed(2)}`);

    const balances = await computeBalances(supabase, userId);
    if (data.amount > balances.available) {
      throw new Error(`Saldo insuficiente. Disponível: R$ ${balances.available.toFixed(2)}`);
    }

    let pixKey: string | null = null;
    if (data.method === "pix") {
      pixKey = (data.pixKey || "").trim();
      if (!pixKey) {
        const { data: p } = await supabase.from("profiles").select("pix_key").eq("id", userId).maybeSingle();
        pixKey = (p?.pix_key as string) || "";
      }
      if (!pixKey) throw new Error("Informe uma chave PIX para receber o resgate.");
      // Persist PIX key on profile for convenience.
      await supabase.from("profiles").update({ pix_key: pixKey } as any).eq("id", userId);
    }

    const { data: inserted, error } = await supabase
      .from("payout_requests")
      .insert({
        user_id: userId,
        method: data.method,
        amount: data.amount,
        pix_key: pixKey,
        user_notes: data.note || null,
        status: "requested",
      } as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const cancelPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Only allow cancelling a still-requested payout — must go through admin update to rejected.
    // The client-side "cancel" is expressed as a user-initiated rejection.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("payout_requests").select("*").eq("id", data.id).maybeSingle();
    if (!row || row.user_id !== userId) throw new Error("Resgate não encontrado.");
    if (row.status !== "requested") throw new Error("Este resgate já está em processamento.");
    const { error } = await supabaseAdmin
      .from("payout_requests")
      .update({ status: "rejected", admin_notes: "Cancelado pelo usuário" } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const confirmPayoutReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("payout_requests")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() } as any)
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("status", "paid");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Admin --------
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminListPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("payout_requests").select("*").order("created_at", { ascending: false }).limit(300);
    const list = (rows ?? []) as any[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    let emails: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id,email").in("id", ids);
      emails = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email]));
    }
    return list.map((r) => ({ ...r, user_email: emails[r.user_id] ?? null }));
  });

export const adminUpdatePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["requested", "approved", "paid", "rejected"]),
      adminNotes: z.string().trim().max(500).optional().nullable(),
      receiptReference: z.string().trim().max(300).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { status: data.status };
    if (data.adminNotes !== undefined) patch.admin_notes = data.adminNotes;
    if (data.receiptReference !== undefined) patch.receipt_reference = data.receiptReference;
    if (data.status === "approved" || data.status === "paid" || data.status === "rejected") {
      patch.processed_at = new Date().toISOString();
      patch.processed_by = context.userId;
    }
    const { error } = await supabaseAdmin.from("payout_requests").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
