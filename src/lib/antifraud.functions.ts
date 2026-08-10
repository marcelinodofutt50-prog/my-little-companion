import { createServerFn } from "@tanstack/react-start";
import type { SignupGuardResult } from "@/lib/antifraud.server";

export type { SignupGuardResult };

/**
 * Verifica, antes do cadastro, quantas contas já saíram deste IP nas últimas 24h.
 * Público de propósito: roda antes de existir sessão. Nunca confia em dados do cliente.
 */
export const checkSignupAllowed = createServerFn({ method: "POST" })
  .validator((input?: { email?: string }) => ({
    email: typeof input?.email === "string" ? input.email.slice(0, 255) : undefined,
  }))
  .handler(async ({ data }): Promise<SignupGuardResult> => {
    const { evaluateSignup } = await import("@/lib/antifraud.server");
    return evaluateSignup(data?.email ?? null);
  });

/** Registra o cadastro concluído (hash do IP + e-mail mascarado) para revisão antifraude. */
export const recordSignupIp = createServerFn({ method: "POST" })
  .validator((input: { email?: string; userId?: string | null }) => ({
    email: typeof input?.email === "string" ? input.email.slice(0, 255) : undefined,
    userId: typeof input?.userId === "string" ? input.userId : null,
  }))
  .handler(async ({ data }) => {
    const { persistSignup } = await import("@/lib/antifraud.server");
    await persistSignup(data);
    return { ok: true };
  });
