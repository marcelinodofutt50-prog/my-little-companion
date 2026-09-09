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

export function summarizeDesk(licenses: any[], payments: any[], customers: any[], now: Date = new Date()) {
  const expiringSoon = licenses.filter((l) => {
    if (l.status !== "active") return false;
    const left = daysLeft(l.expires_at ?? null, now);
    return left !== null && left >= 0 && left <= 5;
  }).length;
  return {
    customers: customers.length,
    activeLicenses: licenses.filter((l) => l.status === "active").length,
    pendingSync: licenses.filter((l) => l.status === "pending_sync").length,
    expiringSoon,
    revenueCents: payments.reduce((s, p) => s + (p.amount_cents ?? 0), 0),
  };
}

/** Duração final da licença: a do plano, ou o prazo personalizado do parceiro. */
export function resolveLicenseDays(planSlug: string, daysOverride?: number | null): number {
  if (typeof daysOverride === "number" && Number.isFinite(daysOverride) && daysOverride > 0) {
    return Math.min(3650, Math.round(daysOverride));
  }
  return PARTNER_PLAN_DAYS[planSlug] ?? 30;
}

/** Dias que faltam para vencer (negativo = já venceu). `null` quando não expira. */
export function daysLeft(expiresAt: string | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - now.getTime()) / 86_400_000);
}

/** Mensagem pronta para o parceiro mandar ao cliente dele (WhatsApp/Telegram). */
export function buildCredentialMessage(input: {
  customerName?: string | null;
  email: string;
  username: string;
  password: string;
  expiresAt?: string | null;
}): string {
  const hello = input.customerName ? `Olá, ${input.customerName}!` : "Olá!";
  const validade = input.expiresAt
    ? `\nValidade: ${new Date(input.expiresAt).toLocaleDateString("pt-BR")}`
    : "";
  return (
    `${hello}\nSeu acesso está pronto:\n\n` +
    `E-mail: ${input.email}\n` +
    `Usuário: ${input.username}\n` +
    `Senha: ${input.password}${validade}\n\n` +
    `Guarde estes dados. Qualquer dúvida, é só chamar.`
  );
}
