/**
 * Generic Rate Limiter (Server-side only).
 * Tracks attempts in the database for sensitive endpoints.
 */
import { clientIp, hashIp } from "./antifraud.server";

export type RateLimitOptions = {
  key: string;
  maxAttempts: number;
  windowMs: number;
  hashIp?: boolean;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
};

/**
 * Fail closed when the IP or persistence layer is unavailable. A missing IP
 * must not silently disable brute-force protection; deployment proxy headers
 * must be configured and trusted for this limiter to work.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const retryAfterFallback = Math.max(1, Math.ceil(options.windowMs / 1000));
  const ip = clientIp();

  if (!ip) {
    console.error("[checkRateLimit] No client IP available; denying request", { key: options.key });
    return { allowed: false, retryAfter: retryAfterFallback, remaining: 0 };
  }

  const identifier = options.hashIp !== false ? await hashIp(ip) : ip;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - options.windowMs).toISOString();
  const bucketKey = `rl:${options.key}`;

  const { data, error } = await supabaseAdmin
    .from("signup_attempts")
    .select("created_at")
    .eq("ip_hash", identifier)
    .eq("outcome", bucketKey)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[checkRateLimit] Attempt-store query failed; denying request", {
      key: options.key,
      code: error.code,
    });
    return { allowed: false, retryAfter: retryAfterFallback, remaining: 0 };
  }

  const attempts = data ?? [];
  const allowed = attempts.length < options.maxAttempts;
  let retryAfter = 0;

  if (!allowed && attempts[0]) {
    const oldest = new Date(attempts[0].created_at).getTime();
    retryAfter = Math.max(1, Math.ceil((oldest + options.windowMs - Date.now()) / 1000));
  }

  return {
    allowed,
    retryAfter,
    remaining: Math.max(0, options.maxAttempts - attempts.length - 1),
  };
}

/** Records an attempt (successful or failed) for rate limiting. */
export async function recordAttempt(
  key: string,
  outcome: "success" | "failure" | "blocked",
  emailMasked?: string | null,
) {
  try {
    const ip = clientIp();
    if (!ip) {
      console.error("[recordAttempt] No client IP available; attempt was not recorded", { key });
      return;
    }

    const ipHash = await hashIp(ip);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: attemptError } = await (supabaseAdmin.from("signup_attempts") as any).insert({
      ip_hash: ipHash,
      email_masked: emailMasked || null,
      outcome: `rl:${key}`,
    });

    if (attemptError) {
      console.error("[recordAttempt] Failed to persist rate-limit attempt", { key, code: attemptError.code });
    }

    const { error: auditError } = await (supabaseAdmin.from("audit_logs") as any).insert({
      event: `AUTH_${key.toUpperCase()}`,
      decision: outcome.toUpperCase(),
      reason: outcome === "blocked" ? "Rate limit exceeded" : outcome,
      system: "Shadow Security Guard",
      metadata: { ip_hash: ipHash, email_masked: emailMasked || null },
    });

    if (auditError) {
      console.error("[recordAttempt] Failed to persist audit event", { key, code: auditError.code });
    }
  } catch (e) {
    console.error("[recordAttempt] Failed to log security event:", e);
  }
}
