import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===== Recuperação de carrinho abandonado =====
// Quando o cliente inicia o checkout e não conclui, geramos um cupom pessoal,
// de uso único e com validade curta. O desconto varia conforme o histórico
// do cliente. Se ele recusar (X), o cupom é apagado.

export const getWinbackOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ planSlug: z.string().trim().min(1).max(64) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { computeWinbackTier, generateWinbackCode, WINBACK_TTL_MINUTES } =
      await import("./winback.server");
    const { supabase, userId } = context;

    // 1. Precisa existir um pedido iniciado e não pago nas últimas 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: pending } = await supabase
      .from("orders")
      .select("id, status, plan_slug, created_at")
      .eq("user_id", userId)
      .eq("plan_slug", data.planSlug)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);

    const abandoned = (pending ?? []).find((o) =>
      ["pending", "created"].includes(String(o.status))
    );
    if (!abandoned) return { offer: null as null };

    // Não oferece se esse plano já foi pago recentemente.
    if ((pending ?? []).some((o) => String(o.status) === "paid")) {
      return { offer: null as null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2. Já existe um cupom winback ativo e válido? Reaproveita.
    const nowIso = new Date().toISOString();
    const { data: existing } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .eq("user_id", userId)
      .eq("source", "winback")
      .eq("active", true)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: plan } = await supabase
      .from("plans").select("name, price_brl").eq("slug", data.planSlug).maybeSingle();

    if (existing) {
      return {
        offer: {
          code: existing.code as string,
          discountPct: Number(existing.discount_pct ?? 0),
          expiresAt: existing.expires_at as string,
          label: (existing.label as string | null) ?? "",
          planSlug: data.planSlug,
          planName: plan?.name ?? data.planSlug,
          priceBrl: Number(plan?.price_brl ?? 0),
        },
      };
    }

    // 3. Perfil do cliente define o tamanho do desconto.
    const { data: paidOrders } = await supabase
      .from("orders").select("amount").eq("user_id", userId).eq("status", "paid");
    const { data: legacyLic } = await supabase
      .from("licenses").select("id").eq("user_id", userId).eq("is_legacy", true).limit(1);

    const paidCount = (paidOrders ?? []).length;
    const totalSpent = (paidOrders ?? []).reduce((s, o) => s + Number(o.amount ?? 0), 0);
    const tier = computeWinbackTier({
      paidOrders: paidCount,
      totalSpent,
      isLegacy: (legacyLic ?? []).length > 0,
    });

    const expiresAt = new Date(Date.now() + WINBACK_TTL_MINUTES * 60 * 1000).toISOString();

    // Código único (tenta algumas vezes em caso de colisão).
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateWinbackCode();
      const { error } = await supabaseAdmin.from("coupons").insert({
        code: candidate,
        discount_pct: tier.discountPct,
        cashback_pct: 0,
        first_deposit_only: false,
        active: true,
        uses_left: 1,
        user_id: userId,
        expires_at: expiresAt,
        source: "winback",
        plan_slug: data.planSlug,
        label: tier.label,
      } as any);
      if (!error) { code = candidate; break; }
      if (!String(error.message).toLowerCase().includes("duplicate")) {
        throw new Error("Não foi possível gerar seu cupom agora.");
      }
    }
    if (!code) throw new Error("Não foi possível gerar seu cupom agora.");

    return {
      offer: {
        code,
        discountPct: tier.discountPct,
        expiresAt,
        label: tier.label,
        planSlug: data.planSlug,
        planName: plan?.name ?? data.planSlug,
        priceBrl: Number(plan?.price_brl ?? 0),
      },
    };
  });

// Cliente recusou a oferta (fechou no X) — o cupom deixa de existir.
export const dismissWinbackOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().max(64).optional() }).parse(input ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("coupons")
      .delete()
      .eq("user_id", context.userId)
      .eq("source", "winback");
    if (data.code) q = q.eq("code", data.code.toUpperCase());
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
