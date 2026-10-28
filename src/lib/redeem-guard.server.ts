import { checkRateLimit, recordAttempt } from "./rate-limit.server";

const REDEEM_LIMIT = { key: "redeem", maxAttempts: 8, windowMs: 15 * 60 * 1000 } as const;

/** Mensagem de bloqueio quando já houve tentativas falhas demais, ou null se pode continuar. */
export async function redeemAttemptBlocked(): Promise<string | null> {
  try {
    const rl = await checkRateLimit(REDEEM_LIMIT);
    if (rl.allowed) return null;
    return `Muitas tentativas de código. Tente novamente em ${Math.ceil(rl.retryAfter / 60)} minutos.`;
  } catch {
    // Se o limitador falhar por configuração, não libera tentativas ilimitadas.
    return "Não foi possível validar sua tentativa agora. Tente novamente em instantes.";
  }
}

export async function recordRedeemFailure(): Promise<void> {
  try {
    await recordAttempt(REDEEM_LIMIT.key, "failure");
  } catch {
    /* telemetria nunca bloqueia */
  }
}
