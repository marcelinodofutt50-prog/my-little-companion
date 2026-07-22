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
