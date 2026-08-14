import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      planSlug: z.string(),
      couponCode: z.string().optional(),
      referralCode: z.string().trim().max(16).optional(),
      useCashback: z.boolean().optional(),
      includeServer: z.boolean().optional(),
      addSigner: z.boolean().optional(),
      returnOrigin: z.string().url(),
      legacyClaim: z.object({
        email: z.string().trim().email().max(255),
        password: z.string().min(1).max(64),
        ip: z.string().trim().min(3).max(45),
        panel: z.enum(["v457", "v46"]),
      }).optional(),
      gift: z.object({
        email: z.string().trim().email().max(255),
        message: z.string().trim().max(300).optional(),
      }).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { createMpPreference } = await import("./mercadopago.server");
    const { supabase, userId } = context;
    const isLoginPlan = data.planSlug.startsWith("login-") || data.planSlug === "trial";
    const isServerPlan = data.planSlug.startsWith("server-");

    // Validação Anti-Confusão: Se o usuário já tem uma licença ativa/trial e tenta
    // comprar um NOVO LOGIN em vez de renovar o servidor, nós bloqueamos com aviso.
    // O usuário pediu que ao comprar um plano ele possa já incluir a renovação,
    // então aqui vamos ser mais permissivos e apenas alertar se for algo crítico.
    if (isLoginPlan && !data.gift) {
      const { data: existingLic } = await supabase
        .from("licenses")
        .select("id, is_trial, expires_at, panel")
        .eq("user_id", userId)
        .is("disabled_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLic) {
        const expires = new Date(existingLic.expires_at || 0);
        const now = new Date();
        const isExpired = expires < now;

        // Se o cliente quer comprar um NOVO LOGIN (nova licença) tendo uma ativa
        // nós permitimos, mas o sistema de webhook cuidará de alinhar as datas
        // ou criar um novo login dependendo do que o admin decidir.
      }
    }



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

    // Soma addons e servidor antecipado se selecionados no simulador
    if (data.includeServer) amount += 450;
    if (data.addSigner) amount += 250;
    let couponRow: { code: string; discount_pct: number; cashback_pct: number } | null = null;
    if (data.couponCode) {
      const { data: c } = await supabase.from("coupons").select("*").eq("code", data.couponCode.toUpperCase()).eq("active", true).maybeSingle();
      const { evaluateCoupon, applyDiscount } = await import("./coupon-rules");
      const verdict = evaluateCoupon(c as any, { userId, planSlug: plan.slug });
      if (!c || !verdict.ok) {
        throw new Error("Cupom inválido, expirado ou não aplicável a este plano.");
      }

      // Cupom de uso limitado só é debitado quando o pagamento confirma.
      // Sem esta trava, o cliente poderia abrir vários pedidos pendentes com o
      // mesmo cupom de uso único e pagar todos com desconto.
      if (c.uses_left !== null && c.uses_left !== undefined) {
        const { data: reservedOrders } = await supabase
          .from("orders")
          .select("id")
          .eq("user_id", userId)
          .eq("coupon_code", c.code)
          .in("status", ["pending", "created", "processing"])
          .limit(1);
        if ((reservedOrders ?? []).length > 0) {
          throw new Error("Você já tem um pedido em aberto usando este cupom. Conclua ou cancele esse pagamento antes de gerar outro.");
        }
      }
      couponRow = c;
      amount = applyDiscount(amount, c.discount_pct);
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
      // Saldo já "reservado" por pedidos pendentes ainda não pagos não pode ser
      // reutilizado — senão o mesmo cashback vira desconto infinito.
      const { data: pendingOrders } = await supabase
        .from("orders").select("cashback_used").eq("user_id", userId).eq("status", "pending");
      const reserved = (pendingOrders ?? []).reduce((s, o) => s + Number(o.cashback_used ?? 0), 0);
      const available = Math.max(0, balance - reserved);
      cashbackUsed = Math.max(0, Math.min(available, amount * 0.5)); // max 50% desconto por cashback
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
    if (plan.category === "upgrade") {
      const { data: prof } = await supabase.from("profiles").select("legacy_status").eq("id", userId).maybeSingle();
      const st = (prof?.legacy_status ?? "unchecked") as string;
      if (st !== "v457" && st !== "both") {
        throw new Error("Upgrade disponível apenas para clientes antigos da v4.5.7.");
      }
      const { data: existing } = await supabase
        .from("licenses").select("id, panel")
        .eq("user_id", userId).eq("panel", "v457").is("disabled_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      upgradeMeta = { from_license_id: existing?.id ?? null, legacy_status: st };
    }

    // ===== Presente: a licença vai para a conta de outra pessoa =====
    let giftMeta: { recipient_id: string; email: string; message: string | null; from: string | null } | null = null;
    if (data.gift) {
      if (plan.category === "upgrade") throw new Error("Upgrade não pode ser presenteado — ele depende da conta antiga do comprador.");
      if (legacyMeta) throw new Error("Renovação legacy não pode ser presenteada.");
      const giftEmail = data.gift.email.toLowerCase();
      const buyerEmail = String(context.claims?.email ?? "").toLowerCase();
      if (giftEmail === buyerEmail) throw new Error("Esse é o seu próprio e-mail. Para comprar pra você, desative a opção de presente.");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: recipient } = await supabaseAdmin
        .from("profiles").select("id,email").ilike("email", giftEmail).maybeSingle();
      if (!recipient) {
        throw new Error("Não encontramos uma conta com esse e-mail. Peça pra pessoa criar a conta no site primeiro (leva 1 minuto) e tente de novo.");
      }
      if (recipient.id === userId) throw new Error("Você não pode presentear a si mesmo.");
      giftMeta = {
        recipient_id: recipient.id,
        email: recipient.email,
        message: data.gift.message?.slice(0, 300) || null,
        from: buyerEmail || null,
      };
    }

    const metadata = {
      ...(legacyMeta ? { legacy_claim: legacyMeta } : {}),
      ...(upgradeMeta ? { upgrade: upgradeMeta } : {}),
      ...(giftMeta ? { gift: giftMeta } : {}),
      includeServer: !!data.includeServer,
      addSigner: !!data.addSigner,
    };

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
        metadata: Object.keys(metadata).length ? metadata : null,
      } as any)
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message || "Falha ao criar pedido");



    const origin = data.returnOrigin.replace(/\/$/, "");
    const notificationUrl = `${origin}/api/public/mp-webhook`;
    const pref = await createMpPreference({
      orderId: order.id,
      planName: `Shadow — ${plan.name}${data.includeServer ? ' + Servidor' : ''}${data.addSigner ? ' + Signer' : ''}`,
      amount: Number(amount.toFixed(2)),
      payerEmail: context.claims?.email as string | undefined,
      successUrl: `${origin}/pagamento/sucesso?order=${order.id}`,
      pendingUrl: `${origin}/pagamento/pendente?order=${order.id}`,
      failureUrl: `${origin}/pagamento/erro?order=${order.id}`,
      notificationUrl,
    });

    {
      // orders é somente-leitura para o usuário (RLS): a gravação do preference_id
      // precisa do client privilegiado, senão a conciliação com o MP nunca acha o pedido.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("orders").update({ mp_preference_id: pref.id }).eq("id", order.id);
    }

    return { orderId: order.id, initPoint: pref.init_point, sandboxInitPoint: pref.sandbox_init_point };
  });

export const getOrderState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase
      .from("orders").select("*").eq("id", data.orderId).eq("user_id", context.userId).maybeSingle();
    if (!order) return { order: null, license: null };

    // Safety net: if the order is still unpaid, ask Mercado Pago directly.
    // If MP confirms an approved payment, fulfill right here — so a missed or
    // unverifiable webhook can never leave a paying customer without access.
    if (["pending", "created", "yaarsa_failed"].includes(String(order.status))) {
      try {
        const { findApprovedPaymentForOrder } = await import("./mercadopago.server");
        const approved = await findApprovedPaymentForOrder(data.orderId, Number(order.amount));
        if (approved) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("orders").update({ mp_payment_id: String(approved.id) }).eq("id", data.orderId);
          const { fulfillOrder } = await import("@/routes/api/public/mp-webhook");
          await fulfillOrder(data.orderId);
        }
      } catch { /* reconciliation is best-effort; polling continues */ }
    }

    const { data: freshOrder } = await context.supabase
      .from("orders").select("*").eq("id", data.orderId).eq("user_id", context.userId).maybeSingle();
    const { data: license } = await context.supabase
      .from("licenses").select("*").eq("order_id", data.orderId).maybeSingle();
    return { order: freshOrder ?? order, license };
  });

export const reconcileMyRecentOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const { data: orders, error } = await context.supabase
      .from("orders")
      .select("id, amount, status")
      .eq("user_id", context.userId)
      .in("status", ["pending", "created", "yaarsa_failed"])
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error("Não foi possível verificar compras recentes.");

    let fulfilled = 0;
    for (const order of orders ?? []) {
      try {
        const { findApprovedPaymentForOrder } = await import("./mercadopago.server");
        const approved = await findApprovedPaymentForOrder(order.id, Number(order.amount));
        if (!approved) continue;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("orders").update({ mp_payment_id: String(approved.id) }).eq("id", order.id);
        const { fulfillOrder } = await import("@/routes/api/public/mp-webhook");
        const result = await fulfillOrder(order.id);
        if (result.ok) fulfilled += 1;
      } catch (error) {
        console.error("[reconcileMyRecentOrders] falha:", order.id, (error as Error)?.message);
      }
    }
    return { checked: orders?.length ?? 0, fulfilled };
  });
