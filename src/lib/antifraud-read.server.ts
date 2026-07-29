/** Leitura administrativa do log antifraude (somente servidor). */
export type SignupIpRow = {
  id: string;
  ip_hash: string;
  email_masked: string | null;
  user_id: string | null;
  user_agent: string | null;
  suspicious: boolean;
  accounts_in_window: number;
  created_at: string;
};

export type SignupIpReport = {
  rows: SignupIpRow[];
  total: number;
  suspiciousCount: number;
  uniqueIps: number;
};

export async function loadSignupIpReport(input: {
  days: number;
  minAccounts: number;
  onlySuspicious: boolean;
  search?: string;
}): Promise<SignupIpReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000).toISOString();

  let query = supabaseAdmin
    .from("signup_ip_log")
    .select("*")
    .gte("created_at", since)
    .gte("accounts_in_window", input.minAccounts)
    .order("created_at", { ascending: false })
    .limit(300);

  if (input.onlySuspicious) query = query.eq("suspicious", true);

  const { data, error } = await query;
  if (error) return { rows: [], total: 0, suspiciousCount: 0, uniqueIps: 0 };

  let rows = (data ?? []) as SignupIpRow[];
  const term = input.search?.trim().toLowerCase();
  if (term) {
    rows = rows.filter(
      (r) =>
        (r.email_masked ?? "").toLowerCase().includes(term) ||
        r.ip_hash.toLowerCase().includes(term),
    );
  }

  return {
    rows,
    total: rows.length,
    suspiciousCount: rows.filter((r) => r.suspicious).length,
    uniqueIps: new Set(rows.map((r) => r.ip_hash)).size,
  };
}
