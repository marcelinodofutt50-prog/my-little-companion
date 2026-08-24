/**
 * Renovação automática das assinaturas (Stripe cobra todo mês/semana).
 *
 * Diferente da primeira compra — que cria um login novo — a renovação apenas
 * empurra a validade do login existente e sincroniza a data no painel Yaarsa.
 */
export async function applySubscriptionRenewal(params: {
  userId: string;
  planSlug: string;
  days: number;
  reference: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { yaarsaExtend } = await import("@/lib/yaarsa.server");

  const { data: licenses } = await supabaseAdmin
    .from("licenses")
    .select("id, plan_slug, expires_at, yaarsa_email, panel")
    .eq("user_id", params.userId)
    .eq("is_trial", false)
    .is("disabled_at", null)
    .order("expires_at", { ascending: true });

  const rows = (licenses ?? []) as any[];
  const target = rows.find((l) => l.plan_slug === params.planSlug) ?? rows[0];

  if (!target) {
    await supabaseAdmin.from("webhook_logs").insert({
      source: "stripe",
      note: `renovação ${params.reference}: nenhuma licença ativa encontrada para ${params.userId}`,
      processed: false,
    });
    return { ok: false, reason: "no-license" };
  }

  const base = target.expires_at && new Date(target.expires_at) > new Date()
    ? new Date(target.expires_at)
    : new Date();
  base.setDate(base.getDate() + params.days);

  await supabaseAdmin
    .from("licenses")
    .update({
      expires_at: base.toISOString(),
      revoked: false,
      status: "active",
      server_overdue_at: null,
    } as any)
    .eq("id", target.id);

  let panelError: string | null = null;
  if (target.yaarsa_email) {
    try {
      const yr = await yaarsaExtend(target.yaarsa_email, base.toISOString().slice(0, 10), target.panel ?? "v457");
      if (yr?.Fail) panelError = String(yr.Fail);
    } catch (e: any) {
      panelError = e?.message ?? "erro de conexão com o painel";
    }
  }

  await supabaseAdmin.from("integration_logs").insert({
    source: "stripe",
    action: "subscription_renewal",
    outcome: panelError ? "partial" : "success",
    ...(panelError ? { error: panelError } : {}),
    context: {
      user_id: params.userId,
      license_id: target.id,
      plan_slug: params.planSlug,
      days: params.days,
      new_expiry: base.toISOString(),
      reference: params.reference,
    } as any,
  } as any);

  return { ok: true, licenseId: target.id, expiresAt: base.toISOString(), panelError };
}
