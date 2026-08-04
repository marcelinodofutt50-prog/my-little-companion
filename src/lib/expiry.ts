// Shared client-side helpers for expiry / server-renewal alerts.

export type ExpirySeverity = "critical" | "warning" | null;

const MS_DAY = 86400000;

export function daysUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - now) / MS_DAY);
}

/** ≤2 days (or already past) = critical, ≤5 days = warning. */
export function severityFromDays(days: number | null): ExpirySeverity {
  if (days === null) return null;
  if (days <= 2) return "critical";
  if (days <= 5) return "warning";
  return null;
}

export function severityColor(sev: ExpirySeverity): { text: string; border: string; bg: string; dot: string } {
  if (sev === "critical") return { text: "text-danger", border: "border-danger/50", bg: "bg-danger/10", dot: "bg-danger" };
  if (sev === "warning") return { text: "text-amber-400", border: "border-amber-400/50", bg: "bg-amber-400/10", dot: "bg-amber-400" };
  return { text: "text-muted-foreground", border: "border-border/50", bg: "bg-background/40", dot: "bg-muted-foreground" };
}

// ===== Regras de renovação (fonte única para painel e avisos) =====

export type LicenseKind = "trial" | "monthly" | "lifetime";

type LicenseLike = {
  plan_slug?: string | null;
  is_trial?: boolean | null;
  expires_at?: string | null;
  server_paid_until?: string | null;
  revoked?: boolean | null;
  disabled_at?: string | null;
  suspended_at?: string | null;
  expires_at_before_suspend?: string | null;
};

export function licenseKind(l: LicenseLike): LicenseKind {
  if (l.is_trial) return "trial";
  const s = (l.plan_slug ?? "").toLowerCase();
  if (s.includes("lifetime") || s.includes("vitalicio")) return "lifetime";
  return "monthly";
}

/** Próximo dia 20 (corte da mensalidade do servidor) a partir de `now`. */
export function nextServerDueDate(now = Date.now()): Date {
  const d = new Date(now);
  const due = new Date(d.getFullYear(), d.getMonth(), 20, 23, 59, 59, 999);
  if (d.getTime() > due.getTime()) due.setMonth(due.getMonth() + 1);
  return due;
}

export type LicenseExpiryState = {
  kind: LicenseKind;
  active: boolean;
  /** Cliente pausou a licença: os dias ficam congelados. */
  paused: boolean;
  /** Tempo (ms) que faltava quando pausou — restaurado no despause. */
  pausedMsLeft: number | null;
  /** Dias até o FIM DA LICENÇA (null = licença sem data / vitalícia). */
  daysLeft: number | null;
  /** Data do countdown principal = sempre o fim da licença do cliente. */
  countdownAt: string | null;
  /** Mensalidade do servidor (informativo, nunca é o countdown da licença). */
  serverDueAt: string | null;
  serverDaysLeft: number | null;
  severity: ExpirySeverity;
  /** Severidade só da mensalidade do servidor. */
  serverSeverity: ExpirySeverity;
  renewalNote: string;
};

/**
 * Estado de expiração usando o relógio do servidor (`now`).
 * - mensal/trial: countdown = `expires_at` (dias comprados). O dia 20 do
 *   servidor NUNCA entra nesse contador.
 * - vitalício: a licença não expira (countdown nulo); a mensalidade do
 *   servidor aparece separada, apenas como informação.
 */
export function licenseExpiryState(l: LicenseLike, now = Date.now()): LicenseExpiryState {
  const kind = licenseKind(l);
  const paused = !!l.suspended_at && !l.revoked && !l.disabled_at;
  const pausedBaseline = paused ? (l.expires_at_before_suspend ?? l.expires_at ?? null) : null;
  const pausedMsLeft = pausedBaseline
    ? Math.max(0, new Date(pausedBaseline).getTime() - new Date(l.suspended_at as string).getTime())
    : null;
  const active =
    !l.revoked && !l.disabled_at && !l.suspended_at &&
    (!l.expires_at || new Date(l.expires_at).getTime() > now);

  const serverDueAt = l.server_paid_until
    ? `${String(l.server_paid_until).slice(0, 10)}T23:59:59`
    : nextServerDueDate(now).toISOString();
  const serverDaysLeft = daysUntil(serverDueAt, now);

  // Vitalício: 20 anos no banco — não faz sentido mostrar contador.
  const licenseEnd = l.expires_at ?? null;
  const isEffectivelyLifetime =
    kind === "lifetime" ||
    (licenseEnd ? new Date(licenseEnd).getTime() - now > 2 * 365 * MS_DAY : false);

  const countdownAt = isEffectivelyLifetime ? null : licenseEnd;
  const daysLeft = daysUntil(countdownAt, now);

  const renewalNote =
    isEffectivelyLifetime
      ? "Sua licença é vitalícia e não expira. Só a mensalidade do servidor precisa ser paga até o dia 20 de cada mês para manter o acesso."
      : kind === "trial"
        ? "Teste grátis de 24 horas exatas contadas a partir da ativação. O contador não depende de meia-noite — quando zerar, o login é encerrado automaticamente."
        : "Sua licença mensal expira quando os dias comprados acabarem. O dia 20 do servidor é uma cobrança separada e não muda esse contador.";

  if (paused) {
    return {
      kind,
      active: false,
      paused: true,
      pausedMsLeft,
      daysLeft: pausedMsLeft === null ? null : Math.ceil(pausedMsLeft / MS_DAY),
      countdownAt: null,
      serverDueAt,
      serverDaysLeft,
      severity: null,
      serverSeverity: null,
      renewalNote:
        "Licença pausada: nenhum dia está sendo contado. Ao despausar, você recebe de volta exatamente o tempo que faltava e a senha original volta a funcionar.",
    };
  }

  return {
    kind,
    active,
    paused: false,
    pausedMsLeft: null,
    daysLeft,
    countdownAt,
    serverDueAt,
    serverDaysLeft,
    severity: severityFromDays(daysLeft),
    serverSeverity: severityFromDays(serverDaysLeft),
    renewalNote,
  };
}


// ===== Countdown em horas/minutos (trial e planos curtos) =====

export type Remaining = {
  totalMs: number;
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Valor grande do card. */
  primary: string;
  /** Unidade do valor grande. */
  unit: string;
  /** Linha secundária detalhada. */
  detail: string;
};

/** Quebra o tempo restante até `iso`. Abaixo de 48h mostra horas (BMob corta na virada). */
export function remainingUntil(iso: string | null | undefined, now = Date.now()): Remaining | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const totalMs = Math.max(0, t - now);
  const secs = Math.floor(totalMs / 1000);
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;
  const expired = t - now <= 0;

  const pad = (n: number) => String(n).padStart(2, "0");
  if (expired) {
    return { totalMs: 0, expired, days: 0, hours: 0, minutes: 0, seconds: 0, primary: "00:00:00", unit: "encerrado", detail: "O tempo desta licença acabou." };
  }
  if (totalMs < 48 * 3600_000) {
    const totalHours = Math.floor(secs / 3600);
    return {
      totalMs, expired, days, hours, minutes, seconds,
      primary: `${pad(totalHours)}:${pad(minutes)}:${pad(seconds)}`,
      unit: "horas restantes",
      detail: `${totalHours}h ${minutes}min até o encerramento automático.`,
    };
  }
  return {
    totalMs, expired, days, hours, minutes, seconds,
    primary: pad(days),
    unit: days === 1 ? "dia restante" : "dias restantes",
    detail: `${days}d ${pad(hours)}h ${pad(minutes)}min restantes.`,
  };
}
