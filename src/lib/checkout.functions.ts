import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      planSlug: z.string(),
      couponCode: z.string().optional(),
      referralCode: z.string().trim().max(16).optional(),
      useCashback: z.boolean().optional(),
      returnOrigin: z.string().url(),
      legacyClaim: z.object({
        email: z.string().trim().email().max(255),
        password: z.string().min(1).max(64),
        ip: z.string().trim().min(3).max(45),
        panel: z.enum(["v457", "v46"]),
      }).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { createMpPreference } = await import("./mercadopago.server");
    const { supabase, userId } = context;


    const { data: plan, error: planErr } = await supabase
      .from("plans").select("*").eq("slug", data.planSlug).eq("active", true).maybeSingle();
    if (planErr || !plan) throw new Error("Plano não encontrado");

    // Guarda: renovação legacy R$250 é exclusiva de clientes antigos v4.5.7.
    if (plan.slug === "server-monthly-legacy") {
      const { data: prof } = await supabase.from("profiles").select("legacy_status").eq("id", userId).maybeSingle();
      const st = (prof?.legacy_status ?? "unchecked") as string;
      if (st !== "v457" && st !== "both") {
        throw new Error("Este preço de renovação é exclusivo para clientes antigos. Use a Renovação Servidor padrão em /planos.");
      }
    }
    // E o inverso: cliente antigo v457 não paga R$450 no server-monthly novo.
    if (plan.slug === "server-monthly") {
      const { data: prof } = await supabase.from("profiles").select("legacy_status").eq("id", userId).maybeSingle();
      const st = (prof?.legacy_status ?? "unchecked") as string;
      if (st === "v457" || st === "both") {
        throw new Error("Você é cliente antigo — use a renovação em /renovar-servidor (R$ 250).");
      }
    }

    let amount = Number(plan.price_brl);
    let couponRow: { code: string; discount_pct: number; cashback_pct: number } | null = null;
    if (data.couponCode) {
      const { data: c } = await supabase.from("coupons").select("*").eq("code", data.couponCode.toUpperCase()).eq("active", true).maybeSingle();
      if (c) {
        couponRow = c;
        amount = amount * (1 - (c.discount_pct ?? 0) / 100);
      }
    }

    // Resolve referral code -> referrer_id (via admin client, needs cross-user lookup)
    let referrerId: string | null = null;
    if (data.referralCode) {
      const code = data.referralCode.toUpperCase();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: ref } = await supabaseAdmin
        .from("profiles").select("id").eq("referral_code", code).maybeSingle();
      if (ref && ref.id !== userId) referrerId = ref.id;
    }

    let cashbackUsed = 0;
    if (data.useCashback) {
      const { data: ledger } = await supabase.from("cashback_ledger").select("amount").eq("user_id", userId);
      const balance = (ledger ?? []).reduce((s, r) => s + Number(r.amount), 0);
      cashbackUsed = Math.min(balance, amount * 0.5); // max 50% desconto por cashback
      amount = Math.max(1, amount - cashbackUsed);
    }

    // Validate + encrypt legacy claim (server renewal for old client) before persisting.
    let legacyMeta: { email: string; password_enc: string; ip: string; panel: "v457" | "v46" } | null = null;
    if (data.legacyClaim) {
      if (plan.category !== "server") throw new Error("legacyClaim só se aplica a planos de servidor");
      const { yaarsaLookupEmail, encrypt } = await import("./yaarsa.server");
      const email = data.legacyClaim.email.toLowerCase();
      const lookup = await yaarsaLookupEmail(email, data.legacyClaim.panel);
      if (!lookup.found) throw new Error(`Email não encontrado no painel ${data.legacyClaim.panel === "v46" ? "Shadow 4.6" : "Shadow 4.5.7"}`);
      legacyMeta = { email, password_enc: encrypt(data.legacyClaim.password), ip: data.legacyClaim.ip.trim(), panel: data.legacyClaim.panel };
    }

    // Upgrade v4.5.7 → v4.6 (R$600): must be flagged as legacy on v457.
    let upgradeMeta: { from_license_id: string | null; legacy_status: string } | null = null;
    if (plan.category === "upgrade" && plan.slug === "upgrade-457-to-46") {
      const { data: prof } = await supabase.from("profiles").select("legacy_status").eq("id", userId).maybeSingle();
      const st = (prof?.legacy_status ?? "unchecked") as string;
      if (st !== "v457" && st !== "both") {
        throw new Error("Upgrade disponível apenas para clientes antigos da v4.5.7. Faça login novamente para revalidarmos sua conta.");
      }
      const { data: existing } = await supabase
        .from("licenses").select("id, panel")
        .eq("user_id", userId).eq("panel", "v457").is("disabled_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      upgradeMeta = { from_license_id: existing?.id ?? null, legacy_status: st };
    }

    const metadata = legacyMeta ? { legacy_claim: legacyMeta } : upgradeMeta ? { upgrade: upgradeMeta } : null;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        plan_slug: plan.slug,
        amount: Number(amount.toFixed(2)),
        coupon_code: couponRow?.code ?? null,
        cashback_used: cashbackUsed,
        referrer_id: referrerId,
        status: "pending",
        metadata,
      } as any)
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message || "Falha ao criar pedido");



    const origin = data.returnOrigin.replace(/\/$/, "");
    const notificationUrl = `${origin}/api/public/mp-webhook`;
    const pref = await createMpPreference({
      orderId: order.id,
      planName: `Shadow — ${plan.name}`,
      amount: Number(amount.toFixed(2)),
      payerEmail: context.claims?.email as string | undefined,
      successUrl: `${origin}/pagamento/sucesso?order=${order.id}`,
      pendingUrl: `${origin}/pagamento/pendente?order=${order.id}`,
      failureUrl: `${origin}/pagamento/erro?order=${order.id}`,
      notificationUrl,
    });

    await supabase.from("orders").update({ mp_preference_id: pref.id }).eq("id", order.id);

    return { orderId: order.id, initPoint: pref.init_point, sandboxInitPoint: pref.sandbox_init_point };
  });

export const getOrderState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase
      .from("orders").select("*").eq("id", data.orderId).eq("user_id", context.userId).maybeSingle();
    if (!order) return { order: null, license: null };
    const { data: license } = await context.supabase
      .from("licenses").select("*").eq("order_id", data.orderId).maybeSingle();
    return { order, license };
  });
