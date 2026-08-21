/**
 * Regras puras da renovação da mensalidade do servidor (corte todo dia 20).
 *
 * Usado pelo webhook do Mercado Pago, pelo autoatendimento ("Já paguei o
 * servidor") e pelos testes ponta a ponta, para que site, banco e painel
 * Yaarsa nunca divirjam.
 */

export type RenewableLicense = {
  id: string;
  plan_slug?: string | null;
  yaarsa_email?: string | null;
  panel?: string | null;
  expires_at?: string | null;
  server_paid_until?: string | null;
  server_overdue_at?: string | null;
  revoked?: boolean | null;
  suspended_at?: string | null;
  disabled_at?: string | null;
  is_trial?: boolean | null;
  status?: string | null;
};

export type RenewalPlan = {
  /** Data enviada ao Yaarsa (YYYY-MM-DD). */
  panelExpireDate: string;
  /** Campos a gravar na licença. */
  patch: {
    server_paid_until: string;
    expires_at: string | null;
    revoked: false;
    server_overdue_at: null;
    status?: string;
  };
  /** Vitalício mantém a data longa; mensal é empurrado para o dia 20. */
  keepsLongerExpiry: boolean;
};

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula o efeito do pagamento da taxa de servidor sobre uma licença.
 *
 * - Mensal/semanal: a licença passa a valer até o próximo dia 20.
 * - Vitalício (ou qualquer licença que já vence depois do dia 20): a data
 *   longa é preservada; só a mensalidade do servidor avança.
 * - Em ambos os casos o acesso volta na hora (sem `revoked`, sem atraso).
 */
export function planServerRenewal(license: RenewableLicense, paidUntil: Date): RenewalPlan {
  const currentEnd = license.expires_at ? new Date(license.expires_at) : null;
  const keepsLongerExpiry = !!currentEnd && currentEnd.getTime() > paidUntil.getTime();
  const expiresAt = keepsLongerExpiry ? license.expires_at! : paidUntil.toISOString();

  const patch: RenewalPlan["patch"] = {
    server_paid_until: paidUntil.toISOString(),
    expires_at: expiresAt,
    revoked: false,
    server_overdue_at: null,
  };
  // Licença pausada pelo cliente continua pausada: pagar o servidor não
  // despausa nem consome os dias congelados.
  if (!license.suspended_at) patch.status = "active";

  // O painel guarda a MENOR data entre a licença e o corte do servidor: é ela
  // que trava o BTmob se a mensalidade do mês seguinte não for paga. No
  // vitalício isso mantém o dia 20 no painel sem rebaixar a licença no site.
  const panelDate = new Date(
    Math.min(new Date(expiresAt).getTime(), paidUntil.getTime()),
  );

  return {
    panelExpireDate: ymd(panelDate),
    patch,
    keepsLongerExpiry,
  };
}

/** Licença elegível à renovação de servidor (teste grátis não paga servidor). */
export function isRenewable(l: RenewableLicense): boolean {
  return !l.is_trial && !l.disabled_at;
}

/**
 * Concilia o que já existe no painel Yaarsa com o que o site pretende gravar.
 *
 * Motivo: o suporte às vezes já corrigiu a data direto no painel (por causa de
 * um bug ou de um pagamento manual). Nesse caso o site NÃO pode encurtar a
 * data do cliente — ele apenas alinha o banco à data maior do painel.
 *
 * @param desiredPanelDate data (YYYY-MM-DD) que o site aplicaria no painel.
 * @param panelDate data lida do painel (YYYY-MM-DD) ou null quando desconhecida.
 * @param dbExpiresAt expiração atual no banco (ISO) ou null (vitalício).
 */
export function reconcilePanelExpiry(
  desiredPanelDate: string,
  panelDate: string | null,
  dbExpiresAt: string | null,
): { shouldPush: boolean; effectivePanelDate: string; dbExpiresAt: string | null; alreadyAhead: boolean } {
  const panelMs = panelDate ? Date.parse(`${panelDate}T23:59:59.000Z`) : NaN;
  const desiredMs = Date.parse(`${desiredPanelDate}T23:59:59.000Z`);
  const alreadyAhead = Number.isFinite(panelMs) && panelMs > desiredMs;

  if (!alreadyAhead) {
    return {
      shouldPush: true,
      effectivePanelDate: desiredPanelDate,
      dbExpiresAt,
      alreadyAhead: false,
    };
  }

  // O painel está à frente: preservamos a data do painel e puxamos o banco
  // para cima (nunca para baixo). Vitalício (null) continua vitalício.
  const dbMs = dbExpiresAt ? Date.parse(dbExpiresAt) : null;
  const nextDb =
    dbExpiresAt === null
      ? null
      : dbMs !== null && Number.isFinite(dbMs) && dbMs > panelMs
        ? dbExpiresAt
        : new Date(panelMs).toISOString();

  return {
    shouldPush: false,
    effectivePanelDate: panelDate!,
    dbExpiresAt: nextDb,
    alreadyAhead: true,
  };
}

/**
 * Decide o que fazer com uma licença a partir da data lida no painel Yaarsa.
 *
 * Caso real: a equipe corrige a data direto no painel (cliente pagou o
 * servidor mas o webhook falhou). O site continuava mostrando "inativa"
 * porque ninguém relia o painel. Aqui a regra é simples:
 *
 * - painel com data FUTURA  → o acesso está pago/liberado: reativa a licença
 *   e alinha a contagem de dias do site pela data do painel (nunca encurta).
 * - painel com data PASSADA → realmente não pagou: nada muda no site.
 * - painel sem leitura      → nada muda (best-effort, nunca piora).
 */
export type PanelSyncDecision = {
  action: "activate" | "already_ok" | "expired_on_panel" | "unknown";
  panelMs: number | null;
  patch: Record<string, unknown> | null;
  reason: string;
};

export function evaluatePanelSync(
  license: RenewableLicense,
  panelDate: string | null,
  now: number = Date.now(),
): PanelSyncDecision {
  if (!panelDate) {
    return { action: "unknown", panelMs: null, patch: null, reason: "painel não respondeu a leitura" };
  }
  const panelMs = Date.parse(`${panelDate}T23:59:59.000Z`);
  if (!Number.isFinite(panelMs)) {
    return { action: "unknown", panelMs: null, patch: null, reason: "data do painel ilegível" };
  }
  if (panelMs <= now) {
    return {
      action: "expired_on_panel",
      panelMs,
      patch: null,
      reason: `painel vencido em ${panelDate} — servidor não está pago`,
    };
  }

  const dbMs = license.expires_at ? Date.parse(license.expires_at) : null;
  const isLifetime = license.expires_at === null;
  const inactive =
    !!license.revoked || !!license.server_overdue_at ||
    (dbMs !== null && Number.isFinite(dbMs) && dbMs <= now);
  const dbBehind = dbMs !== null && Number.isFinite(dbMs) && dbMs < panelMs;

  if (!inactive && !dbBehind) {
    return { action: "already_ok", panelMs, patch: null, reason: "site já estava alinhado com o painel" };
  }

  const patch: Record<string, unknown> = {
    revoked: false,
    server_overdue_at: null,
    // A data do painel é o corte real do servidor.
    server_paid_until: new Date(panelMs).toISOString(),
  };
  // Vitalício continua vitalício: só a mensalidade do servidor foi acertada.
  if (!isLifetime) patch['expires_at'] = new Date(Math.max(panelMs, dbMs ?? 0)).toISOString();
  // Licença pausada pelo cliente continua pausada.
  if (!license.suspended_at) patch['status'] = "active";

  return {
    action: "activate",
    panelMs,
    patch,
    reason: `painel liberado até ${panelDate}`,
  };
}
