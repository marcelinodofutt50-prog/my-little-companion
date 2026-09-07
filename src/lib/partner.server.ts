/**
 * Regras dos produtos de parceria (revenda de logins e serviços de servidor).
 * Todo o acesso é liberado por aqui quando o pedido é confirmado como pago.
 */

export type PartnerKind = "reseller" | "deploy" | "managed";

export const PARTNER_PLANS: Record<string, { kind: PartnerKind; days: number | null; label: string }> = {
  "partner-reseller-60d": { kind: "reseller", days: 60, label: "Servidor de Revenda" },
  "server-deploy-basic": { kind: "deploy", days: null, label: "Subimos seu Servidor" },
  "server-deploy-managed": { kind: "deploy", days: null, label: "Subida + Proteção + Supervisão" },
  "server-managed-monthly": { kind: "managed", days: 30, label: "Gestão Mensal do Servidor" },
};

export function partnerKindFromSlug(slug: string): PartnerKind | null {
  return PARTNER_PLANS[slug]?.kind ?? null;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export async function grantPartnerEntitlement(
  admin: any,
  input: { userId: string; orderId: string; planSlug: string; days?: number | null },
): Promise<{ ok: boolean; kind: PartnerKind | "unknown"; entitlementId?: string; error?: string }> {
  const meta = PARTNER_PLANS[input.planSlug];
  if (!meta) return { ok: false, kind: "unknown", error: `plano de parceria desconhecido: ${input.planSlug}` };

  // Idempotência: o mesmo pedido nunca libera dois acessos.
  const { data: already } = await admin
    .from("partner_entitlements")
    .select("id")
    .eq("order_id", input.orderId)
    .maybeSingle();
  if (already?.id) return { ok: true, kind: meta.kind, entitlementId: already.id };

  const days = input.days ?? meta.days;

  // Renovação: se já existe acesso do mesmo tipo, soma o tempo em vez de duplicar.
  if (days) {
    const { data: existing } = await admin
      .from("partner_entitlements")
      .select("id, expires_at, status")
      .eq("user_id", input.userId)
      .eq("kind", meta.kind)
      .in("status", ["active", "pending_setup", "expired"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const current = existing.expires_at ? new Date(existing.expires_at) : new Date();
      const base = current.getTime() > Date.now() ? current : new Date();
      const { error } = await admin
        .from("partner_entitlements")
        .update({
          expires_at: addDays(base, days).toISOString(),
          status: "active",
          plan_slug: input.planSlug,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) return { ok: false, kind: meta.kind, error: error.message };
      return { ok: true, kind: meta.kind, entitlementId: existing.id };
    }
  }

  const { data: created, error } = await admin
    .from("partner_entitlements")
    .insert({
      user_id: input.userId,
      order_id: input.orderId,
      plan_slug: input.planSlug,
      kind: meta.kind,
      status: meta.kind === "deploy" ? "pending_setup" : "active",
      expires_at: days ? addDays(new Date(), days).toISOString() : null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, kind: meta.kind, error: error.message };

  // Serviço de instalação: abre automaticamente o chamado pra equipe.
  if (meta.kind === "deploy") {
    await admin.from("partner_service_requests").insert({
      user_id: input.userId,
      entitlement_id: created.id,
      kind: "deploy",
      status: "open",
      notes: `Pedido ${input.orderId} — ${meta.label}`,
    });
  }

  return { ok: true, kind: meta.kind, entitlementId: created.id };
}

export function isEntitlementActive(row: { status: string; expires_at: string | null }): boolean {
  if (row.status === "cancelled") return false;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return false;
  return row.status === "active" || row.status === "pending_setup";
}
