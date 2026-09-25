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
  const { setExpiryAnyPanel } = await import("@/lib/license-cron.server");
  const { acquireOpLock, releaseOpLock } = await import("@/lib/audit-trail.server");

  // Brecha corrigida: a Stripe reenvia o mesmo aviso de cobrança quando não
  // recebe resposta a tempo. Cada reenvio somava os dias de novo (um mês pago
  // virava dois). Agora cada cobrança só é aplicada uma vez.
  const lockKey = `sub-renewal:${params.reference}`;
  if (!(await acquireOpLock(lockKey, 120, "stripe"))) return { ok: false, reason: "in-progress" };
  try {
    const { data: prior } = await supabaseAdmin
      .from("integration_logs")
      .select("id")
      .eq("action", "subscription_renewal")
      .contains("context", { reference: params.reference } as any)
      .limit(1);
    if (prior?.length) return { ok: true, duplicate: true };
    return await applyOnce(params, supabaseAdmin, setExpiryAnyPanel);
  } finally {
    await releaseOpLock(lockKey);
  }
}

async function applyOnce(
  params: { userId: string; planSlug: string; days: number; reference: string },
  supabaseAdmin: any,
  setExpiryAnyPanel: (email: string, panel: string | null, exp: string) => Promise<{ status: string; error: string | null }>,
) {

  const { data: licenses } = await supabaseAdmin
    .from("licenses")
    .select("id, plan_slug, expires_at, yaarsa_email, panel")
    .eq("user_id", params.userId)
    .eq("is_trial", false)
    .is("disabled_at", null)
    .order("expires_at", { ascending: true });

  const rows = (licenses ?? []) as any[];
  // Só usa outra licença como alvo quando o cliente tem uma única: antes a
  // renovação podia cair na licença errada (ex.: vitalícia ou de outro plano).
  const target =
    rows.find((l) => l.plan_slug === params.planSlug) ??
    (rows.length === 1 && rows[0].plan_slug !== "login-lifetime" ? rows[0] : undefined);

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
      // Procura a conta em todos os painéis (4.5.5, 4.5.7, 4.6) e grava a
      // data com a mesma folga de 1 dia usada no resto do sistema.
      const yr = await setExpiryAnyPanel(target.yaarsa_email, target.panel, base.toISOString());
      if (yr.status !== "done") panelError = yr.error ?? "conta não encontrada no painel";
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
