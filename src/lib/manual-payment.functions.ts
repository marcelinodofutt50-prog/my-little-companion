import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { manualPaymentError, resolveManualAmount, manualPaymentAuditMeta, MANUAL_PAYMENT_METHOD } from "./manual-payment-rules";

/**
 * Registro de pagamento feito por fora (PIX enviado direto no chat do suporte).
 * Só admin. Cria o pedido com o preço oficial do plano e dispara a MESMA
 * entrega automática de uma compra normal (licença nova ou renovação),
 * para o cliente receber o acesso sem esperar a equipe montar tudo à mão.
 */
export const registerManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      customerEmail: z.string().trim().email().max(255),
      planSlug: z.string().trim().min(1).max(80),
      targetLicenseId: z.string().uuid().optional(),
      evidenceId: z.string().uuid().optional(),
      note: z.string().trim().max(300).optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminRole } = await import("./roles.server");
    await assertAdminRole(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.customerEmail.toLowerCase();
    const { data: customer } = await supabaseAdmin
      .from("profiles").select("id,email").ilike("email", email).maybeSingle();
    if (!customer) throw new Error("Não encontramos uma conta com esse e-mail.");

    const { data: plan } = await supabaseAdmin
      .from("plans").select("slug,name,price_brl,category,active").eq("slug", data.planSlug).maybeSingle();

    const ruleError = manualPaymentError({
      plan: plan as any,
      targetLicenseId: data.targetLicenseId ?? null,
      note: data.note ?? null,
    });
    if (ruleError) throw new Error(ruleError);

    // Renovação: o login precisa ser do cliente informado.
    if (plan.category === "server") {
      const { data: target } = await supabaseAdmin
        .from("licenses").select("id,is_trial,disabled_at")
        .eq("id", data.targetLicenseId!).eq("user_id", customer.id).maybeSingle();
      if (!target) throw new Error("Login não encontrado na conta deste cliente.");
      if (target.is_trial) throw new Error("O teste grátis não usa renovação de servidor.");
      if (target.disabled_at) throw new Error("Este login está desativado — regularize antes de renovar.");
    }

    // Comprovante (opcional): precisa pertencer ao cliente.
    if (data.evidenceId) {
      const { data: evidence } = await supabaseAdmin
        .from("purchase_evidence").select("id,user_id").eq("id", data.evidenceId).maybeSingle();
      if (!evidence || evidence.user_id !== customer.id) {
        throw new Error("Comprovante não encontrado para este cliente.");
      }
    }

    // Valor oficial: confere com a mesma regra de integridade usada na entrega
    // (cobre oferta de boas-vindas ativa sem confiar em valor digitado).
    const { validateCanonicalOrderAmount } = await import("./order-integrity.server");
    const draft = {
      id: "", user_id: customer.id, plan_slug: plan.slug,
      amount: Number(plan.price_brl), created_at: new Date().toISOString(), metadata: {},
    };
    const integrity = await validateCanonicalOrderAmount(supabaseAdmin, draft as any);
    const resolved = resolveManualAmount(Number(plan.price_brl), integrity);
    if (!resolved.ok) throw new Error(`Plano indisponível para registro (${resolved.reason}).`);

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: customer.id,
        plan_slug: plan.slug,
        amount: resolved.amount,
        status: "pending",
        metadata: {
          manual_payment: {
            method: MANUAL_PAYMENT_METHOD,
            registered_by: context.userId,
            note: (data.note ?? "").trim().slice(0, 300) || null,
            evidence_id: data.evidenceId ?? null,
          },
          ...(data.targetLicenseId ? { target_license_id: data.targetLicenseId } : {}),
        },
      } as any)
      .select("id")
      .single();
    if (orderError || !order) throw new Error("Não foi possível criar o pedido.");

    // Vincula o comprovante ao pedido criado (sem apagar vínculo anterior).
    if (data.evidenceId) {
      await supabaseAdmin.from("purchase_evidence")
        .update({ order_id: order.id }).eq("id", data.evidenceId).is("order_id", null);
    }

    // Entrega imediata pelo fluxo oficial (licença nova ou renovação).
    const { fulfillOrder } = await import("./fulfillment.server");
    const delivery = await fulfillOrder(order.id);

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      system: "manual_payment",
      event: "register",
      metadata: manualPaymentAuditMeta({
        orderId: order.id, customerId: customer.id, planSlug: plan.slug,
        amount: resolved.amount, targetLicenseId: data.targetLicenseId ?? null,
        evidenceId: data.evidenceId ?? null, note: data.note ?? null,
      }),
    } as any);

    return {
      ok: true,
      orderId: order.id,
      delivered: delivery.ok,
      reason: (delivery as any).reason ?? null,
      amount: resolved.amount,
    };
  });

/** Planos ativos para o formulário de registro manual. */
export const listPlansForManualPayment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdminRole } = await import("./roles.server");
    await assertAdminRole(context);
    const { data: plans, error } = await context.supabase
      .from("plans").select("slug,name,price_brl,category").eq("active", true)
      .order("price_brl", { ascending: true });
    if (error) throw new Error("Não foi possível carregar os planos.");
    return { plans: plans ?? [] };
  });

/** Logins pagos do cliente (para escolher qual renovar no registro manual). */
export const listCustomerLicensesForManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ customerEmail: z.string().trim().email().max(255) }).parse(v))
  .handler(async ({ data, context }) => {
    const { assertAdminRole } = await import("./roles.server");
    await assertAdminRole(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer } = await supabaseAdmin
      .from("profiles").select("id").ilike("email", data.customerEmail.toLowerCase()).maybeSingle();
    if (!customer) return { customerId: null, licenses: [] };
    const { data: licenses, error } = await supabaseAdmin
      .from("licenses")
      .select("id,plan_slug,yaarsa_email,is_trial,disabled_at,server_paid_until")
      .eq("user_id", customer.id).eq("is_trial", false).is("disabled_at", null)
      .order("created_at", { ascending: false }).limit(20);
    if (error) throw new Error("Não foi possível carregar os logins do cliente.");
    // Nunca expõe senha — só o necessário para identificar o login.
    return {
      customerId: customer.id,
      licenses: (licenses ?? []).map((l: any) => ({
        id: l.id, plan_slug: l.plan_slug, yaarsa_email: l.yaarsa_email,
        server_paid_until: l.server_paid_until,
      })),
    };
  });

/** Histórico de pagamentos registrados por fora (auditoria da equipe). */
export const listManualPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ page: z.number().int().min(0).max(1000).default(0) }).parse(v))
  .handler(async ({ data, context }) => {
    const { assertAdminRole } = await import("./roles.server");
    await assertAdminRole(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error, count } = await supabaseAdmin
      .from("orders")
      .select("id,user_id,plan_slug,amount,status,created_at,paid_at,metadata", { count: "exact" })
      .not("metadata->manual_payment", "is", null)
      .order("created_at", { ascending: false })
      .range(data.page * 20, data.page * 20 + 19);
    if (error) throw new Error("Não foi possível carregar os registros.");
    const userIds = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id,email").in("id", userIds)
      : { data: [] as any[] };
    const emailById = new Map((profiles ?? []).map((p: any) => [p.id, p.email]));
    return {
      total: count ?? 0,
      rows: (rows ?? []).map((r: any) => ({
        id: r.id,
        customer_email: emailById.get(r.user_id) ?? null,
        plan_slug: r.plan_slug,
        amount: r.amount,
        status: r.status,
        created_at: r.created_at,
        paid_at: r.paid_at,
        note: r.metadata?.manual_payment?.note ?? null,
        registered_by: r.metadata?.manual_payment?.registered_by ?? null,
      })),
    };
  });
