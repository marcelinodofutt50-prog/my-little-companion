import { tierFromPlanSlug, type VersionTier } from "@/lib/plans";

export type PanelKey = "v455" | "v457" | "v46";

/** Painel real da licença (fonte da verdade = coluna `panel`). */
export function panelOfLicense(l: {
  panel?: string | null;
  version_tier?: string | null;
  plan_slug?: string | null;
}): PanelKey {
  const p = (l.panel ?? "").toLowerCase();
  if (p === "v455" || p === "v457" || p === "v46") return p;
  const tier = (l.version_tier as VersionTier | null) ?? tierFromPlanSlug(l.plan_slug);
  return tier === "lifetime_46" ? "v46" : tier === "weekly" ? "v455" : "v457";
}

export function panelVersionLabel(panel: PanelKey): string {
  return panel === "v46" ? "4.6" : panel === "v455" ? "4.5.5" : "4.5.7";
}

/** Nome legível do plano — evita mostrar slugs crus como `login-30d`. */
export function planLabel(slug: string | null | undefined, isTrial?: boolean): string {
  const s = (slug ?? "").toLowerCase();
  if (isTrial || s === "trial") return "Teste grátis · 1 dia";
  if (s.includes("lifetime")) return "Vitalício";
  if (s.includes("play-protect")) return "Play Protect";
  const days = s.match(/(\d+)\s*d/);
  if (days) {
    const n = Number(days[1]);
    if (n === 7) return "Semanal · 7 dias";
    if (n === 30) return "Mensal · 30 dias";
    return `${n} dias`;
  }
  return slug ?? "—";
}

/** Rótulo curto de versão/duração usado abaixo do plano. */
export function licenseKindLabel(l: {
  panel?: string | null;
  version_tier?: string | null;
  plan_slug?: string | null;
  is_trial?: boolean | null;
}): string {
  const version = panelVersionLabel(panelOfLicense(l));
  if (l.is_trial) return `TESTE · ${version}`;
  const s = (l.plan_slug ?? "").toLowerCase();
  if (s.includes("lifetime")) return `VITALÍCIO · ${version}`;
  if (s.includes("7d") || s.includes("week")) return `SEMANAL · ${version}`;
  return `MENSAL · ${version}`;
}

export function panelTone(panel: PanelKey): string {
  return panel === "v46" ? "text-violet" : panel === "v455" ? "text-cyan" : "text-neon";
}
