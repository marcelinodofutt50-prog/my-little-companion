import { createServerFn } from "@tanstack/react-start";
import type { EmailAvailability } from "@/lib/signup-guard.server";

export type { EmailAvailability };

/**
 * Verifica se já existe conta na mesma caixa de entrada (inclui aliases do Gmail).
 * Público de propósito: roda antes de existir sessão. Só devolve um booleano
 * e um e-mail mascarado — nunca dados da conta.
 */
export const checkEmailAvailability = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => ({
    email: String(input?.email ?? "").trim().slice(0, 255).toLowerCase(),
  }))
  .handler(async ({ data }): Promise<EmailAvailability> => {
    const { checkEmailAvailability: run } = await import("@/lib/signup-guard.server");
    return run(data.email);
  });

/**
 * Libera o login imediato de uma conta recém-criada quando o backend ainda
 * exige confirmação de e-mail. Só afeta contas criadas nos últimos minutos.
 */
export const confirmFreshSignupEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => ({
    email: String(input?.email ?? "").trim().slice(0, 255).toLowerCase(),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { confirmFreshSignup } = await import("@/lib/signup-confirm.server");
    return confirmFreshSignup(data.email);
  });
