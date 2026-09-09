import { applyDiscount, clampDiscountPct, evaluateCoupon, MIN_CHARGE_BRL } from "./coupon-rules";

type DbClient = any;

export type CanonicalOrder = {
  id: string;
  user_id: string;
  plan_slug: string;
  amount: number | string;
  coupon_code?: string | null;
  cashback_used?: number | string | null;
  metadata?: Record<string, unknown> | null;
  status?: string | null;
  created_at?: string | null;
};

export type CanonicalAmountResult = {
  ok: boolean;
  expectedAmount: number;
  actualAmount: number;
  reason?: string;
  planName?: string;
};

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function validateCanonicalOrderAmount(
  client: DbClient,
  order: CanonicalOrder,
): Promise<CanonicalAmountResult> {
  const { data: plan, error: planError } = await client
    .from("plans")
    .select("slug,name,price_brl,active")
    .eq("slug", order.plan_slug)
    .maybeSingle();

  const actualAmount = money(Number(order.amount));
  if (planError || !plan || plan.active === false) {
    return { ok: false, expectedAmount: 0, actualAmount, reason: "invalid-plan" };
  }

  let expectedAmount = Number(plan.price_brl);
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    return { ok: false, expectedAmount: 0, actualAmount, reason: "invalid-plan-price", planName: plan.name };
  }

  const meta = (order.metadata ?? {}) as Record<string, unknown>;
  if (meta["includeServer"] === true) expectedAmount += 450;
  if (meta["addSigner"] === true) expectedAmount += 250;

  if (order.coupon_code) {
    const { data: coupon } = await client
      .from("coupons")
      .select("code,active,user_id,expires_at,plan_slug,uses_left,discount_pct")
      .eq("code", String(order.coupon_code).toUpperCase())
      .maybeSingle();
    // O desconto é conferido como estava NO MOMENTO DA COMPRA. Cupons de curta
    // duração (winback) venciam antes da confirmação do Pix e derrubavam
    // pedidos já pagos; o mesmo valia para o uso consumido pela própria compra.
    const placedAt = order.created_at ? new Date(order.created_at).getTime() : Date.now();
    const verdict = evaluateCoupon(coupon, {
      userId: order.user_id,
      planSlug: order.plan_slug,
      now: Number.isFinite(placedAt) ? placedAt : Date.now(),
    });
    const lockedIn =
      !verdict.ok && coupon && ["expired", "used_up", "inactive"].includes(verdict.reason) && !!order.created_at;
    if (!verdict.ok && !lockedIn) {
      return { ok: false, expectedAmount: money(expectedAmount), actualAmount, reason: `invalid-coupon:${verdict.reason}`, planName: plan.name };
    }
    expectedAmount = applyDiscount(
      expectedAmount,
      verdict.ok ? verdict.discountPct : clampDiscountPct((coupon as any)?.discount_pct),
    );
  }

  const cashbackUsed = Number(order.cashback_used ?? 0);
  if (!Number.isFinite(cashbackUsed) || cashbackUsed < 0 || cashbackUsed > expectedAmount * 0.5 + 0.009) {
    return { ok: false, expectedAmount: money(expectedAmount), actualAmount, reason: "invalid-cashback", planName: plan.name };
  }
  expectedAmount = Math.max(MIN_CHARGE_BRL, expectedAmount - cashbackUsed);
  expectedAmount = money(expectedAmount);

  if (!Number.isFinite(actualAmount) || actualAmount < MIN_CHARGE_BRL || Math.abs(actualAmount - expectedAmount) > 0.009) {
    return { ok: false, expectedAmount, actualAmount, reason: "amount-mismatch", planName: plan.name };
  }

  return { ok: true, expectedAmount, actualAmount, planName: plan.name };
}

export async function assertCanonicalOrderAmount(client: DbClient, order: CanonicalOrder) {
  const result = await validateCanonicalOrderAmount(client, order);
  if (!result.ok) {
    throw new Error(`Pedido bloqueado por divergência de preço (${result.reason ?? "invalid"}).`);
  }
  return result;
}