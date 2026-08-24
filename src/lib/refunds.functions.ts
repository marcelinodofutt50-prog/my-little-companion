import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createGeminiProvider } from "./gemini-provider.server";

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
  .validator((i: unknown) =>
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

    await logRefundAudit({
      refundId: (inserted as any).id,
      actorId: userId,
      action: "created",
      toStatus: "requested",
      notes: "Pedido criado pelo cliente",
    });

    const { notifyRefundStatus } = await import("@/lib/refund-notify.server");
    await notifyRefundStatus({ userId, status: "requested", amount: Number((order as any).amount) });

    return inserted;
  });

// -------- Auditoria --------
/** Registra uma entrada no log de auditoria do reembolso (nunca derruba a operação principal). */
async function logRefundAudit(entry: {
  refundId: string;
  actorId?: string | null;
  action: "created" | "status_change" | "ai_verify";
  fromStatus?: string | null;
  toStatus?: string | null;
  aiVerdict?: string | null;
  aiConfidence?: number | null;
  notes?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let actorEmail: string | null = null;
    if (entry.actorId) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", entry.actorId)
        .maybeSingle();
      actorEmail = (prof as any)?.email ?? null;
    }
    await (supabaseAdmin.from("refund_audit_log") as any).insert({
      refund_id: entry.refundId,
      actor_id: entry.actorId ?? null,
      actor_email: actorEmail,
      action: entry.action,
      from_status: entry.fromStatus ?? null,
      to_status: entry.toStatus ?? null,
      ai_verdict: entry.aiVerdict ?? null,
      ai_confidence: entry.aiConfidence ?? null,
      notes: entry.notes ?? null,
    });
  } catch {
    // auditoria é best-effort
  }
}

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

    // Log de auditoria de cada pedido de reembolso.
    const audit: Record<string, any[]> = {};
    if (list.length) {
      const { data: logs } = await (supabaseAdmin.from("refund_audit_log") as any)
        .select("*")
        .in("refund_id", list.map((r) => r.id))
        .order("created_at", { ascending: false })
        .limit(1000);
      for (const l of ((logs ?? []) as any[])) {
        (audit[l.refund_id] ??= []).push(l);
      }
    }

    return list.map((r) => ({ ...r, user_email: emails[r.user_id] ?? null, audit: audit[r.id] ?? [] }));
  });


export const adminUpdateRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
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

    const { data: before } = await supabaseAdmin
      .from("refund_requests")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();

    const patch: any = { status: data.status };
    if (data.adminNotes !== undefined) patch.admin_notes = data.adminNotes;
    if (data.status !== "requested") {
      patch.processed_at = new Date().toISOString();
      patch.processed_by = context.userId;
    }
    const { data: updated, error } = await supabaseAdmin
      .from("refund_requests")
      .update(patch)
      .eq("id", data.id)
      .select("user_id,amount,status")
      .single();
    if (error) throw new Error(error.message);

    await logRefundAudit({
      refundId: data.id,
      actorId: context.userId,
      action: "status_change",
      fromStatus: (before as any)?.status ?? null,
      toStatus: data.status,
      notes: data.adminNotes ?? null,
    });

    if (updated) {
      const { notifyRefundStatus } = await import("@/lib/refund-notify.server");
      await notifyRefundStatus({
        userId: (updated as any).user_id,
        status: data.status,
        amount: Number((updated as any).amount),
        adminNotes: data.adminNotes ?? null,
      });
    }

    return { ok: true };
  });

// -------- Verificação automática (IA) do comprovante/pedido --------
export const adminVerifyRefundAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: refund } = await supabaseAdmin
      .from("refund_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!refund) throw new Error("Pedido de reembolso não encontrado.");

    const r = refund as any;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", r.order_id)
      .maybeSingle();

    const o = (order ?? {}) as any;

    // Confere o pagamento direto na fonte (Mercado Pago), quando houver id.
    let gateway: any = null;
    const paymentId = o.payment_id ?? o.mp_payment_id ?? o.external_id ?? null;
    if (paymentId) {
      try {
        const { createStripeClient } = await import("@/lib/stripe.server");
        const { serverStripeEnv } = await import("@/lib/stripe-payments.server");
        const stripe = createStripeClient(serverStripeEnv());
        const p: any = String(paymentId).startsWith("cs_")
          ? await stripe.checkout.sessions.retrieve(String(paymentId))
          : await stripe.paymentIntents.retrieve(String(paymentId));
        const amount = Number(p?.amount_received ?? p?.amount_total ?? p?.amount ?? 0) / 100;
        gateway = {
          status: p?.status ?? p?.payment_status ?? null,
          status_detail: p?.last_payment_error?.message ?? null,
          amount,
          date_approved: p?.created ? new Date(p.created * 1000).toISOString() : null,
          payer_email: p?.customer_details?.email ?? p?.receipt_email ?? null,
          refunded: Boolean(p?.latest_charge?.refunded),
        };
      } catch {
        gateway = { error: "não foi possível consultar o gateway" };
      }
    }

    // Checagens determinísticas (a IA só interpreta, não inventa).
    const checks: { label: string; ok: boolean; detail: string }[] = [];
    const paidAt = o.paid_at ?? o.created_at ?? null;
    const withinWindow = paidAt
      ? Date.now() - new Date(paidAt).getTime() <= REFUND_WINDOW_DAYS * 86400000
      : false;

    checks.push({
      label: "Pedido pago",
      ok: o.status === "paid",
      detail: `status do pedido: ${o.status ?? "desconhecido"}`,
    });
    checks.push({
      label: `Dentro da janela de ${REFUND_WINDOW_DAYS} dias`,
      ok: withinWindow,
      detail: paidAt ? `pago em ${new Date(paidAt).toLocaleString("pt-BR")}` : "sem data de pagamento",
    });
    checks.push({
      label: "Valor confere",
      ok: Number(r.amount) === Number(o.amount ?? -1),
      detail: `reembolso ${r.amount} vs pedido ${o.amount ?? "?"}`,
    });
    if (gateway && !gateway.error) {
      checks.push({
        label: "Pagamento aprovado no gateway",
        ok: gateway.status === "approved",
        detail: `gateway: ${gateway.status ?? "?"} / ${gateway.status_detail ?? "-"}`,
      });
      checks.push({
        label: "Ainda não estornado",
        ok: !gateway.refunded,
        detail: gateway.refunded ? "já existe estorno registrado" : "sem estorno anterior",
      });
      if (gateway.amount != null) {
        checks.push({
          label: "Valor bate com o gateway",
          ok: Math.abs(Number(gateway.amount) - Number(r.amount)) < 0.01,
          detail: `gateway ${gateway.amount} vs pedido de reembolso ${r.amount}`,
        });
      }
    }

    const failed = checks.filter((c) => !c.ok);
    const model = createGeminiProvider("gemini-1.5-flash");

    const prompt = [
      "Você é um analista antifraude de uma loja digital brasileira. Avalie se este pedido de reembolso é legítimo.",
      "Baseie-se APENAS nos dados abaixo. Não invente informações.",
      "",
      "CHECAGENS AUTOMÁTICAS:",
      ...checks.map((c) => `- [${c.ok ? "OK" : "FALHOU"}] ${c.label} (${c.detail})`),
      "",
      `MOTIVO INFORMADO PELO CLIENTE: ${r.reason}`,
      `CHAVE PIX INFORMADA: ${r.pix_key ?? "não informada"}`,
      `COMPROVANTE/OBSERVAÇÕES: ${r.receipt_url ?? r.proof_url ?? "nenhum anexo"}`,
      `DADOS DO GATEWAY: ${gateway ? JSON.stringify(gateway) : "indisponível"}`,
      "",
      "Responda em português, em no máximo 6 linhas, neste formato exato:",
      "VEREDITO: LEGITIMO | SUSPEITO | INVALIDO",
      "CONFIANCA: <0-100>",
      "MOTIVOS: <bullets curtos>",
      "RECOMENDACAO: <aprovar, recusar ou revisar manualmente e por quê>",
    ].join("\n");

    let analysis = "";
    try {
      const res = await generateText({
        model,
        prompt,
      });
      analysis = res.text.trim();
    } catch (e: any) {
      throw new Error(`Falha na análise de IA: ${e?.message ?? "erro desconhecido"}`);
    }

    const verdict = /VEREDITO:\s*(LEGITIMO|SUSPEITO|INVALIDO)/i.exec(analysis)?.[1]?.toUpperCase() ?? "SUSPEITO";
    const confidence = Number(/CONFIANCA:\s*(\d+)/i.exec(analysis)?.[1] ?? 0);

    await logRefundAudit({
      refundId: data.id,
      actorId: context.userId,
      action: "ai_verify",
      fromStatus: r.status ?? null,
      toStatus: r.status ?? null,
      aiVerdict: verdict,
      aiConfidence: Number.isFinite(confidence) ? confidence : null,
      notes: `Checagens reprovadas: ${checks.filter((c) => !c.ok).length}/${checks.length} · modelo Gemini`,
    });

    return {
      verdict,
      confidence,
      analysis,
      checks,
      failedCount: failed.length,
      gateway,
      evidence: {
        refund: {
          id: r.id,
          amount: Number(r.amount),
          status: r.status,
          reason: r.reason,
          pix_key: r.pix_key ?? null,
          created_at: r.created_at,
          deadline_at: r.deadline_at,
        },
        order: {
          id: o.id ?? null,
          plan_slug: o.plan_slug ?? null,
          amount: o.amount != null ? Number(o.amount) : null,
          status: o.status ?? null,
          paid_at: o.paid_at ?? null,
          created_at: o.created_at ?? null,
          mp_payment_id: paymentId ? String(paymentId) : null,
          days_since_payment: paidAt
            ? Math.floor((Date.now() - new Date(paidAt).getTime()) / 86400000)
            : null,
        },
        windowDays: REFUND_WINDOW_DAYS,
        reviewDays: REFUND_REVIEW_DAYS,
        links: {
          gateway: paymentId ? `https://dashboard.stripe.com/payments/${paymentId}` : null,
          userSupport: r.user_id ? `/admin?user=${r.user_id}` : null,
        },
        model: "gemini-1.5-flash",
        verifiedAt: new Date().toISOString(),
      },
    };
  });