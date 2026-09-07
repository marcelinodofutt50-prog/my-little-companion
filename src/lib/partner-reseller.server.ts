/**
 * Regras puras da revenda do parceiro (sem rede e sem banco), para poderem ser
 * testadas de ponta a ponta.
 */

export const PARTNER_PLAN_DAYS: Record<string, number> = {
  "login-7d": 7,
  "login-30d": 30,
  "login-lifetime": 7300,
};

export function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** Nunca encurta o acesso: renova a partir da data futura, se houver. */
export function planPartnerRenewal(
  planSlug: string,
  currentExpiresAt: string | null,
  now: Date = new Date(),
): Date {
  const days = PARTNER_PLAN_DAYS[planSlug] ?? 30;
  const current = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const base = current && current.getTime() > now.getTime() ? current : now;
  return addDays(base, days);
}

export type SyncAction = "reaffirm" | "create" | "abort";

/**
 * Só recria a conta quando o painel afirma que ela não existe. Resposta
 * inconclusiva mantém a licença como está — recriar às cegas apagaria acesso.
 */
export function decideSyncAction(state: "found" | "missing" | "unknown"): SyncAction {
  if (state === "found") return "reaffirm";
  if (state === "missing") return "create";
  return "abort";
}

export function isResellerEntitlementActive(row: {
  kind?: string | null;
  status?: string | null;
  expires_at?: string | null;
}, now: Date = new Date()) {
  if (row.kind !== "reseller") return false;
  if ((row.status ?? "active") !== "active") return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > now.getTime();
}

export function summarizeDesk(licenses: any[], payments: any[], customers: any[]) {
  return {
    customers: customers.length,
    activeLicenses: licenses.filter((l) => l.status === "active").length,
    pendingSync: licenses.filter((l) => l.status === "pending_sync").length,
    revenueCents: payments.reduce((s, p) => s + (p.amount_cents ?? 0), 0),
  };
}
