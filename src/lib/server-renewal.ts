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
