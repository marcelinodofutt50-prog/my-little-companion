/**
 * Confirmação automática de e-mail logo após o cadastro (somente servidor).
 *
 * O produto entrega acesso imediato: o cliente cria a conta e já entra no painel.
 * Quando o projeto está configurado para exigir confirmação, o login logo após o
 * signUp falha com "Email not confirmed". Aqui confirmamos o e-mail do usuário
 * recém-criado para que o login imediato funcione.
 *
 * Segurança: só confirma contas criadas há poucos minutos e que ainda não têm
 * e-mail confirmado. Não devolve nenhum dado da conta.
 */

const MAX_AGE_MS = 15 * 60 * 1000;

export async function confirmFreshSignup(rawEmail: string): Promise<{ ok: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error || !data?.users) return { ok: false };

    const user = data.users.find((u: any) => (u.email ?? "").toLowerCase() === email);
    if (!user) return { ok: false };
    if ((user as any).email_confirmed_at) return { ok: true };

    const createdAt = new Date((user as any).created_at ?? 0).getTime();
    if (!createdAt || Date.now() - createdAt > MAX_AGE_MS) return { ok: false };

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });
    if (updErr) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
