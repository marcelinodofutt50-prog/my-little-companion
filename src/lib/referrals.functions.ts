import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicUserLabel } from "@/lib/privacy";

export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("referral_code, referral_reward_pref, pix_key")
      .eq("id", userId)
      .maybeSingle();

    const { data: referralCode } = await supabase
      .from("referral_codes")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: referrals } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false });

    const rows = (referrals ?? []) as any[];
    const referredIds = rows.map((r) => r.referred_id);
    
    let labelMap: Record<string, string> = {};
    if (referredIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, email, display_name").in("id", referredIds);
      labelMap = Object.fromEntries(
        (profs ?? []).map((p: any) => [p.id, publicUserLabel(p.display_name, p.email)]),
      );
    }

    const { data: level } = await supabase
      .from("referral_levels")
      .select("*")
      .lte("min_conversions", rows.filter(r => r.status === 'converted').length)
      .order("min_conversions", { ascending: false })
      .limit(1)
      .maybeSingle();

    const totalGranted = rows.filter((r) => r.status === "converted").length;
    const totalPending = rows.filter((r) => r.status === "pending").length;

    return {
      code: referralCode?.code ?? profile?.referral_code ?? null,
      pref: (profile?.referral_reward_pref as "cashback" | "free_month" | "pix") ?? "cashback",
      pixKey: (profile?.pix_key as string) ?? null,
      referrals: rows.map((r) => ({ ...r, referred_label: labelMap[r.referred_id] ?? "Membro Shadow" })),
      stats: { total: rows.length, granted: totalGranted, pending: totalPending },
      level: level ?? { name: "Novato", min_conversions: 0 }
    };
  });


export const updateReferralPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
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
  .validator((i: unknown) => z.object({ code: z.string().trim().min(4).max(16) }).parse(i))
  .handler(async ({ data, context }) => {
    const code = data.code.toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("id, display_name").eq("referral_code", code).maybeSingle();
    if (!prof || prof.id === context.userId) return { valid: false };
    return { valid: true, referrerName: (prof as any).display_name || "Membro Shadow" };
  });

export const adminMarkReferralPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ referralId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("referrals")
      .update({ reward_status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.referralId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

