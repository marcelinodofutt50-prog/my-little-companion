export type PlanCategory = "license" | "server" | "source";
export type Plan = {
  slug: string;
  name: string;
  description: string;
  price_brl: number;
  days: number | null;
  category: PlanCategory;
  active: boolean;
  sort_order: number;
};

export function formatBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ============ Version tiers ============
export type VersionTier = "weekly" | "monthly_457" | "lifetime_46";

export type TierFeatures = {
  version: string;
  bypass_play_protect: boolean;
  free_updates: boolean;
  priority_support: boolean;
  full_features: boolean;
};

export function tierFromPlanSlug(slug: string | null | undefined): VersionTier {
  if (!slug) return "monthly_457";
  const s = slug.toLowerCase();
  if (s.includes("lifetime")) return "lifetime_46";
  if (s.includes("7d") || s.includes("week") || s === "trial") return "weekly";
  return "monthly_457";
}

export function getTierFeatures(tier: VersionTier): TierFeatures {
  switch (tier) {
    case "lifetime_46":
      return { version: "Shadow 4.6+", bypass_play_protect: true, free_updates: true, priority_support: true, full_features: true };
    case "monthly_457":
      return { version: "Shadow 4.5.7", bypass_play_protect: true, free_updates: false, priority_support: false, full_features: true };
    case "weekly":
      return { version: "Shadow 4.5.5", bypass_play_protect: false, free_updates: false, priority_support: false, full_features: false };
  }
}

export function tierLabel(tier: VersionTier): string {
  return tier === "lifetime_46" ? "VITALÍCIO · 4.6" : tier === "monthly_457" ? "MENSAL · 4.5.7" : "SEMANAL · 4.5.5";
}

export function tierAccent(tier: VersionTier): "neon" | "cyan" | "violet" {
  return tier === "lifetime_46" ? "violet" : tier === "monthly_457" ? "neon" : "cyan";
}

export function serverFeeFor(isLegacy: boolean, override?: number | null): number {
  if (override && override > 0) return Number(override);
  return isLegacy ? 250 : 450;
}

// Downloads catalog filtered by tier
export type DownloadFile = { label: string; url: string; latest?: boolean; note?: string };
export function downloadsForTier(tier: VersionTier): DownloadFile[] {
  const shadow455 = { label: "Shadow 4.5.5", url: "https://www.mediafire.com/file/2gliqqrenn1x6ul/shadow+4.5.7.rar/file", note: "básico" };
  const shadow457 = { label: "Shadow 4.5.7", url: "https://www.mediafire.com/file/2gliqqrenn1x6ul/shadow+4.5.7.rar/file" };
  const shadow46 = { label: "Shadow 4.6 (latest)", url: "https://www.mediafire.com/file/7lrde75obvokj1u/shadow+4.6.rar/file", latest: true };
  if (tier === "lifetime_46") return [shadow46, shadow457];
  if (tier === "monthly_457") return [shadow457];
  return [shadow455];
}
