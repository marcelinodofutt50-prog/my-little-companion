import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public security check for sensitive auth actions.
 * Used by the client to verify if they are rate limited before attempting Supabase Auth.
 */
export const checkAuthSecurity = createServerFn({ method: "POST" })
  .validator((input: { email: string; action: 'login' | 'signup' | 'recovery' }) => 
    z.object({
      email: z.string().email(),
      action: z.enum(['login', 'signup', 'recovery'])
    }).parse(input)
  )
  .handler(async ({ data }) => {
    try {
      const { checkRateLimit, recordAttempt } = await import("./rate-limit.server");
      const { maskEmail } = await import("./antifraud.server");
      // Default configs
      const configs = {
        login: { max: 5, window: 5 * 60 * 1000 }, // 5 attempts per 5 mins
        signup: { max: 3, window: 60 * 60 * 1000 }, // 3 attempts per hour (IP level checked elsewhere too)
        recovery: { max: 3, window: 15 * 60 * 1000 }, // 3 recoveries per 15 mins
      };

      const config = configs[data.action];
      const rl = await checkRateLimit({
        key: data.action,
        maxAttempts: config.max,
        windowMs: config.window
      });

      if (!rl.allowed) {
        await recordAttempt(data.action, "blocked", maskEmail(data.email));
        return {
          allowed: false,
          message: `Muitas tentativas de ${data.action}. Tente novamente em ${Math.ceil(rl.retryAfter / 60)} minutos.`,
          retryAfter: rl.retryAfter
        };
      }
    } catch (error) {
      const { isIpHashSaltConfigurationError } = await import("./antifraud.server");
      if (isIpHashSaltConfigurationError(error)) {
        console.error("[security] Proteção de autenticação indisponível por configuração inválida do hash de IP.");
        return {
          allowed: false,
          code: "SECURITY_CONFIGURATION_UNAVAILABLE" as const,
          message: "Não foi possível validar sua conexão com segurança. Tente novamente mais tarde ou fale com o suporte.",
        };
      }
      // Falhas de telemetria não devem se passar por bloqueio antifraude.
      console.error("[security] rate limit indisponível; autenticação liberada:", error);
      return {
        allowed: true,
        warning: "A verificação preventiva está temporariamente indisponível, mas você pode entrar ou criar sua conta normalmente.",
      };
    }

    return { allowed: true };
  });

/**
 * Records a successful or failed auth attempt for security auditing.
 */
export const reportAuthOutcome = createServerFn({ method: "POST" })
  .validator((input: { email: string; action: 'login' | 'signup' | 'recovery'; success: boolean }) => 
    z.object({
      email: z.string().email(),
      action: z.enum(['login', 'signup', 'recovery']),
      success: z.boolean()
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const { recordAttempt } = await import("./rate-limit.server");
    const { maskEmail } = await import("./antifraud.server");
    await recordAttempt(data.action, data.success ? "success" : "failure", maskEmail(data.email));
    return { ok: true };
  });
