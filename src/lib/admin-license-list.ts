import { panelOfLicense } from "@/lib/license-display";

export type AdminLicenseStatus = "active" | "expiring" | "expired" | "revoked" | "paused" | "disabled";

export type AdminLicenseRow = {
  id?: string;
  user_id?: string;
  revoked?: boolean | null;
  disabled_at?: string | null;
  suspended_at?: string | null;
  pause_until?: string | null;
  expires_at?: string | null;
  server_overdue_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  yaarsa_username?: string | null;
  yaarsa_email?: string | null;
  server_ip?: string | null;
  plan_slug?: string | null;
  panel?: string | null;
  version_tier?: string | null;
  profile?: { email?: string | null; full_name?: string | null } | null;
};

const DAY_MS = 86_400_000;

/** Display classification only: never authorizes a panel operation. */
export function adminLicenseStatus(l: AdminLicenseRow, now: number): AdminLicenseStatus {
  if (l.revoked) return "revoked";
  if (l.disabled_at) return "disabled";
  if (l.suspended_at) return "paused";
  if (!l.expires_at) return "active";
  const expiry = Date.parse(l.expires_at);
  if (!Number.isFinite(expiry)) return "disabled";
  if (expiry <= now) return "expired";
  if (expiry - now <= 5 * DAY_MS) return "expiring";
  return "active";
}

export function isAdminLicenseArchived(l: AdminLicenseRow, now: number): boolean {
  const status = adminLicenseStatus(l, now);
  // Frozen days must not move a paused license into the archive.
  if (status !== "expired" && status !== "revoked" && status !== "disabled") return false;
  const reference = status === "expired"
    ? l.expires_at
    : l.server_overdue_at ?? l.disabled_at ?? l.updated_at ?? l.created_at;
  const timestamp = reference ? Date.parse(reference) : NaN;
  return Number.isFinite(timestamp) && now - timestamp > 3 * DAY_MS;
}

export function matchesAdminLicenseSearch(l: AdminLicenseRow, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("pt-BR");
  if (!q) return true;
  const fields = [l.id, l.user_id, l.yaarsa_username, l.yaarsa_email, l.profile?.email,
    l.profile?.full_name, l.plan_slug, l.server_ip, panelOfLicense(l)];
  return fields.some((value) => value?.toLocaleLowerCase("pt-BR").includes(q));
}