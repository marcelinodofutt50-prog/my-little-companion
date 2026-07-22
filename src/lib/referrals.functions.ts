import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("referral_code, referral_reward_pref, pix_key")
      .eq("id", userId)
      .maybeSingle();

    const { data: referrals } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false });

    const rows = (referrals ?? []) as any[];
    const referredIds = rows.map((r) => r.referred_id);
    let emailMap: Record<string, string> = {};
    if (referredIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, email").in("id", referredIds);
      emailMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email]));
    }

    const totalGranted = rows.filter((r) => r.reward_status !== "pending").length;
    const totalPending = rows.filter((r) => r.reward_status === "pending").length;
    const totalCashback = rows
      .filter((r) => r.reward_type === "cashback" && r.reward_status !== "pending")
      .reduce((s, r) => s + Number(r.reward_amount), 0);

    return {
      code: (profile?.referral_code as string) ?? null,
      pref: (profile?.referral_reward_pref as "cashback" | "free_month" | "pix") ?? "cashback",
      pixKey: (profile?.pix_key as string) ?? null,
      referrals: rows.map((r) => ({ ...r, referred_email: emailMap[r.referred_id] ?? null })),
      stats: { total: rows.length, granted: totalGranted, pending: totalPending, cashback: totalCashback },
    };
  });

export const updateReferralPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      pref: z.enum(["cashback", "free_month", "pix"]),
      pixKey: z.string().trim().max(120).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        referral_reward_pref: data.pref,
        pix_key: data.pref === "pix" ? (data.pixKey || null) : null,
      } as any)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const validateReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: z.string().trim().min(4).max(16) }).parse(i))
  .handler(async ({ data, context }) => {
    const code = data.code.toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("id, full_name").eq("referral_code", code).maybeSingle();
    if (!prof || prof.id === context.userId) return { valid: false };
    return { valid: true, referrerName: (prof as any).full_name || "Membro Shadow" };
  });
