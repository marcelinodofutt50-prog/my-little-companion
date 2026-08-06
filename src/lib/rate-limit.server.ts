/**
 * Generic Rate Limiter (Server-side only).
 * Prevents brute-force on sensitive endpoints by tracking attempts in the database.
 */
import { clientIp, hashIp } from "./antifraud.server";

export type RateLimitOptions = {
  /** Unique identifier for the bucket (e.g. 'login', 'signup', 'recovery') */
  key: string;
  /** Maximum attempts allowed in the window */
  maxAttempts: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Whether to hash the IP (privacy) */
  hashIp?: boolean;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
};

/**
 * Checks if the current request is within rate limits.
 * Uses `signup_attempts` table as a general-purpose attempt log for now,
 * but tags it with the specific key.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const ip = clientIp();
  if (!ip) return { allowed: true, retryAfter: 0, remaining: options.maxAttempts };

  const identifier = options.hashIp !== false ? await hashIp(ip) : ip;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  const since = new Date(Date.now() - options.windowMs).toISOString();
  const bucketKey = `rl:${options.key}`;

  // Use audit_logs or a dedicated table. signup_attempts is already used for signup.
  // We'll use signup_attempts but prefix the outcome or use context if available.
  // Actually, let's create a more generic record in audit_logs for sensitive failures
  // and check against them.
  
  const { data } = await supabaseAdmin
    .from("signup_attempts")
    .select("created_at")
    .eq("ip_hash", identifier)
    .eq("outcome", bucketKey)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

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

/**
 * Records an attempt (successful or failed) for rate limiting.
 */
export async function recordAttempt(key: string, outcome: "success" | "failure" | "blocked", emailMasked?: string | null) {
  try {
    const ip = clientIp();
    if (!ip) return;
    const ipHash = await hashIp(ip);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Log to signup_attempts for rate limiting logic
    await supabaseAdmin.from("signup_attempts").insert({
      ip_hash: ipHash,
      email_masked: emailMasked || null,
      outcome: `rl:${key}`, // Used as the bucket key
    });

    // Log to audit_logs for admin visibility
    await supabaseAdmin.from("audit_logs").insert({
      event: `AUTH_${key.toUpperCase()}`,
      decision: outcome.toUpperCase(),
      reason: outcome === "blocked" ? "Rate limit exceeded" : outcome,
      system: "Shadow Security Guard",
      context: {
        ip_hash: ipHash,
        email_masked: emailMasked || null
      }
    });
  } catch (e) {
    console.error("[recordAttempt] Failed to log security event:", e);
  }
}
