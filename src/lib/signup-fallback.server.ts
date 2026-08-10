/**
 * Plano B de cadastro (somente servidor).
 *
 * Quando o Supabase recusa o signUp porque o envio de e-mail estourou o limite
 * ("over_email_send_rate_limit" / "Error sending confirmation email"), a conta
 * simplesmente não é criada e o cliente fica travado. Aqui criamos a conta pela
 * API administrativa, sem depender do envio de e-mail. A confirmação é feita
 * depois, pelo banner do painel e pelo cron de reenvio.
 *
 * Segurança: só cria conta nova (nunca sobrescreve existente), exige e-mail
 * válido e senha mínima, e não devolve nenhum dado da conta.
 */

export type FallbackSignupResult = {
  ok: boolean;
  /** já existia conta com este e-mail */
  exists?: boolean;
  reason?: string;
};

async function findUserByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const users = data?.users ?? [];
    const found = users.find((u: any) => (u.email ?? "").toLowerCase() === email);
    if (found) return found;
    if (users.length < 200) break;
  }
  return null;
}

export async function createAccountFallback(
  rawEmail: string,
  password: string,
): Promise<FallbackSignupResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes("@") || email.length < 5) return { ok: false, reason: "invalid_email" };
  if (typeof password !== "string" || password.length < 6) return { ok: false, reason: "weak_password" };

  try {
    // Antifraude/rate limit no servidor: este endpoint cria contas confirmadas,
    // então ele precisa das MESMAS travas do cadastro normal.
    const { evaluateSignup, persistSignup } = await import("@/lib/antifraud.server");
    const guard = await evaluateSignup(email);
    if (!guard.allowed) {
      return { ok: false, reason: guard.reason ?? "signup_blocked" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existing = await findUserByEmail(email);
    if (existing) return { ok: false, exists: true, reason: "already_exists" };

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      // Confirmado na criação para o cliente entrar na hora; o aviso de
      // "confirme seu e-mail" só existe porque o envio estava indisponível.
      email_confirm: true,
    });
    if (error) return { ok: false, reason: error.message };
    await persistSignup({ email, userId: data?.user?.id ?? null });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: String(e?.message ?? "unknown") };
  }
}

