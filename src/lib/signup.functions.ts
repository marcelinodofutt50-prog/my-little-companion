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

/**
 * Plano B quando o cadastro normal falha por limite de envio de e-mail.
 * Cria a conta pela API administrativa para o cliente entrar na hora.
 */
export const createAccountWhenEmailBlocked = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => ({
    email: String(input?.email ?? "").trim().slice(0, 255).toLowerCase(),
    password: String(input?.password ?? "").slice(0, 200),
  }))
  .handler(async ({ data }) => {
    const { createAccountFallback } = await import("@/lib/signup-fallback.server");
    return createAccountFallback(data.email, data.password);
  });

