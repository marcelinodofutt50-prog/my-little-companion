/**
 * Lógica antifraude de cadastro (somente servidor).
 * Fica separada do arquivo .functions.ts porque helpers irmãos de um
 * createServerFn são removidos no bundle do servidor (ReferenceError).
 */
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Configuração por variável de ambiente (lida a cada request, sem recompilar):
 * - ANTIFRAUD_MAX_ACCOUNTS_PER_IP: máximo de contas por IP na janela (default 3)
 * - ANTIFRAUD_SUSPICIOUS_THRESHOLD: acima disso marca como suspeito (default 2)
 * - ANTIFRAUD_WINDOW_HOURS: tamanho da janela em horas (default 24)
 */
function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function antifraudConfig() {
  const maxAccounts = envInt("ANTIFRAUD_MAX_ACCOUNTS_PER_IP", 3, 1, 1000);
  const suspicious = envInt("ANTIFRAUD_SUSPICIOUS_THRESHOLD", 2, 1, 1000);
  const windowHours = envInt("ANTIFRAUD_WINDOW_HOURS", 24, 1, 24 * 30);
  return {
    maxAccounts,
    // limiar de suspeito nunca acima do bloqueio: seria inútil
    suspiciousThreshold: Math.min(suspicious, maxAccounts),
    windowMs: windowHours * 60 * 60 * 1000,
    windowHours,
  };
}


/** IP real do cliente, lido apenas de headers do servidor. */
export function clientIp(): string | null {
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf.trim();
  const xr = getRequestHeader("x-real-ip");
  if (xr) return xr.trim();
  const xff = getRequestHeader("x-forwarded-for");
  // Só a primeira entrada é confiável; o resto pode ser injetado pelo cliente.
  if (xff) return xff.split(",")[0]!.trim();
  return null;
}

export function clientUserAgent(): string | null {
  return (getRequestHeader("user-agent") ?? "").slice(0, 200) || null;
}

/** sha256(ip + salt) — nunca guardamos o IP em claro. */
export function resolveHashSalt(): string {
  const explicit = process.env.IP_HASH_SALT ?? "";
  if (explicit.length >= 16) return explicit;
  // Fallback determinístico: mantém o hash com chave secreta mesmo quando a
  // variável dedicada não foi provisionada no ambiente. Antifraude nunca pode
  // derrubar login/cadastro por falta de configuração.
  const derived =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_URL ??
    "";
  if (derived.length >= 16) return `shadow-ip-fallback:${derived}`;
  return "shadow-ip-fallback:local-development-salt";
}

export async function hashIp(ip: string): Promise<string> {
  const salt = resolveHashSalt();
  const bytes = new TextEncoder().encode(`${ip}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function maskEmail(email?: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return null;
  return `${user.slice(0, 1)}${"*".repeat(Math.max(1, user.length - 1))}@${domain}`;
}

export async function countRecentSignups(ipHash: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - antifraudConfig().windowMs).toISOString();
  const { count } = await supabaseAdmin
    .from("signup_ip_log")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  return count ?? 0;
}

/** Conexão liberada manualmente pelo admin (ignora o bloqueio). */
export async function isAllowlisted(ipHash: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("antifraud_allowlist")
    .select("expires_at")
    .eq("ip_hash", ipHash)
    .maybeSingle();
  if (!data) return false;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return false;
  return true;
}

export type SignupGuardResult = {
  allowed: boolean;
  reason?: string;
  accountsInWindow: number;
  /** segundos até poder tentar de novo (rate limit por tentativas) */
  retryAfter?: number;
};

/**
 * Rate limit ad-hoc de tentativas de cadastro por conexão.
 * Configurável por env:
 * - ANTIFRAUD_MAX_ATTEMPTS (default 5)
 * - ANTIFRAUD_ATTEMPTS_WINDOW_MIN (default 10)
 */
export function rateLimitConfig() {
  return {
    maxAttempts: envInt("ANTIFRAUD_MAX_ATTEMPTS", 5, 2, 100),
    windowMs: envInt("ANTIFRAUD_ATTEMPTS_WINDOW_MIN", 10, 1, 24 * 60) * 60 * 1000,
  };
}

/** Registra a tentativa e devolve quantas houve na janela + quando libera. */
async function checkAndRecordAttempt(
  ipHash: string,
  email?: string | null,
): Promise<{ blocked: boolean; retryAfter: number }> {
  const cfg = rateLimitConfig();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - cfg.windowMs).toISOString();
  const { data } = await supabaseAdmin
    .from("signup_attempts")
    .select("created_at")
    .eq("ip_hash", ipHash)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const attempts = data ?? [];
  const blocked = attempts.length >= cfg.maxAttempts;
  // libera quando a tentativa mais antiga sair da janela
  const oldest = attempts[0] ? new Date(attempts[0].created_at).getTime() : Date.now();
  const retryAfter = blocked
    ? Math.max(1, Math.ceil((oldest + cfg.windowMs - Date.now()) / 1000))
    : 0;

  await supabaseAdmin.from("signup_attempts").insert({
    ip_hash: ipHash,
    email_masked: maskEmail(email ?? undefined),
    outcome: blocked ? "rate_limited" : "attempt",
  });

  return { blocked, retryAfter };
}

export async function evaluateSignup(email?: string | null): Promise<SignupGuardResult> {
  try {
    const cfg = antifraudConfig();
    const ip = clientIp();
    if (!ip) return { allowed: true, accountsInWindow: 0 };
    const ipHash = await hashIp(ip);
    const allowlisted = await isAllowlisted(ipHash);

    if (!allowlisted) {
      // 1) Rate limit: muitas tentativas seguidas nesta conexão
      const rl = await checkAndRecordAttempt(ipHash, email);
      if (rl.blocked) {
        const mins = Math.ceil(rl.retryAfter / 60);
        return {
          allowed: false,
          accountsInWindow: 0,
          retryAfter: rl.retryAfter,
          reason: `Muitas tentativas de cadastro nesta conexão. Tente de novo em ${mins} min ou fale com o suporte.`,
        };
      }
    }

    // 2) Limite de contas por conexão na janela longa
    const used = await countRecentSignups(ipHash);
    if (used >= cfg.maxAccounts && !allowlisted) {
      return {
        allowed: false,
        accountsInWindow: used,
        reason: `Detectamos várias contas criadas nesta conexão nas últimas ${cfg.windowHours} horas. Se você é um cliente real, fale com o suporte que liberamos manualmente.`,
      };
    }
    return { allowed: true, accountsInWindow: used };
  } catch {
    // Antifraude nunca pode derrubar a venda: em erro, libera.
    return { allowed: true, accountsInWindow: 0 };
  }
}


export async function persistSignup(input: { email?: string; userId?: string | null }) {
  try {
    const ip = clientIp();
    if (!ip) return;
    const ipHash = await hashIp(ip);
    const used = await countRecentSignups(ipHash);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("signup_ip_log").insert({
      ip_hash: ipHash,
      email_masked: maskEmail(input.email),
      user_id: input.userId ?? null,
      user_agent: clientUserAgent(),
      accounts_in_window: used + 1,
      suspicious: used + 1 > antifraudConfig().suspiciousThreshold,
    });

  } catch {
    // registro nunca quebra o cadastro
  }
}
