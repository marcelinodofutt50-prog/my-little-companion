/**
 * Regras puras do registro manual de pagamento (PIX feito por fora, no chat).
 * Sem acesso a banco/rede — testável isoladamente.
 */

export const MANUAL_PAYMENT_METHOD = "pix_externo";

export type ManualPlan = {
  slug: string;
  name: string;
  price_brl: number | string;
  category: string;
  active?: boolean;
};

export type ManualPaymentCheck = {
  plan: ManualPlan | null;
  targetLicenseId?: string | null;
  note?: string | null;
};

/**
 * Valida a intenção de registro antes de tocar no banco.
 * Retorna a mensagem de erro (pt-BR) ou null quando está tudo certo.
 */
export function manualPaymentError(check: ManualPaymentCheck): string | null {
  const { plan } = check;
  if (!plan || plan.active === false) return "Plano não encontrado ou inativo.";
  const price = Number(plan.price_brl);
  if (!Number.isFinite(price) || price <= 0) return "Plano sem preço válido.";
  // Renovação de servidor por fora precisa dizer QUAL login será renovado —
  // sem isso a entrega não sabe onde aplicar o pagamento.
  if (plan.category === "server" && !check.targetLicenseId) {
    return "Selecione o login do cliente que será renovado.";
  }
  // Upgrade depende da conta antiga do próprio cliente no checkout — o registro
  // manual não consegue validar isso com segurança.
  if (plan.category === "upgrade") {
    return "Upgrade não pode ser registrado por fora — peça ao cliente para pagar pelo site.";
  }
  const note = (check.note ?? "").trim();
  if (note.length > 300) return "Observação muito longa (máx. 300 caracteres).";
  return null;
}

/**
 * Resolve o valor que o pedido manual deve carregar para passar na conferência
 * de integridade de preço na entrega. A conferência oficial pode devolver um
 * valor esperado diferente (ex.: oferta de boas-vindas ativa); nesse caso o
 * valor esperado manda.
 */
export function resolveManualAmount(
  planPrice: number,
  integrity: { ok: boolean; expectedAmount: number; reason?: string },
): { ok: true; amount: number } | { ok: false; reason: string } {
  if (integrity.ok) return { ok: true, amount: Math.round(planPrice * 100) / 100 };
  if (integrity.reason === "amount-mismatch" && Number.isFinite(integrity.expectedAmount) && integrity.expectedAmount > 0) {
    return { ok: true, amount: Math.round(integrity.expectedAmount * 100) / 100 };
  }
  return { ok: false, reason: integrity.reason ?? "invalid" };
}

/** Resumo seguro para auditoria — nunca inclui senha nem documento. */
export function manualPaymentAuditMeta(input: {
  orderId: string;
  customerId: string;
  planSlug: string;
  amount: number;
  targetLicenseId?: string | null;
  evidenceId?: string | null;
  note?: string | null;
}) {
  return {
    order_id: input.orderId,
    customer_id: input.customerId,
    plan_slug: input.planSlug,
    amount: input.amount,
    method: MANUAL_PAYMENT_METHOD,
    target_license_id: input.targetLicenseId ?? null,
    evidence_id: input.evidenceId ?? null,
    note: (input.note ?? "").trim().slice(0, 300) || null,
  };
}
