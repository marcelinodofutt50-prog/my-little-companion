/**
 * Lógica antifraude de cadastro (somente servidor).
 * Fica separada do arquivo .functions.ts porque helpers irmãos de um
 * createServerFn são removidos no bundle do servidor (ReferenceError).
 */
import { getRequestHeader } from "@tanstack/react-start/server";

/** Máximo de contas criadas a partir do mesmo IP em 24h. */
export const MAX_ACCOUNTS_PER_IP_24H = 3;
/** Acima disso marcamos como suspeito para revisão do admin (sem bloquear). */
export const SUSPICIOUS_THRESHOLD = 2;
const WINDOW_MS = 24 * 60 * 60 * 1000;

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
export async function hashIp(ip: string): Promise<string> {
  const salt = process.env.IP_HASH_SALT ?? "";
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
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export async function countRecentSignups(ipHash: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from("signup_ip_log")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  return count ?? 0;
}

export type SignupGuardResult = {
  allowed: boolean;
  reason?: string;
  accountsInWindow: number;
};

export async function evaluateSignup(): Promise<SignupGuardResult> {
  try {
    const ip = clientIp();
    if (!ip) return { allowed: true, accountsInWindow: 0 };
    const used = await countRecentSignups(await hashIp(ip));
    if (used >= MAX_ACCOUNTS_PER_IP_24H) {
      return {
        allowed: false,
        accountsInWindow: used,
        reason:
          "Detectamos várias contas criadas nesta conexão nas últimas 24 horas. Se você é um cliente real, fale com o suporte que liberamos manualmente.",
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
      suspicious: used + 1 > SUSPICIOUS_THRESHOLD,
    });
  } catch {
    // registro nunca quebra o cadastro
  }
}
