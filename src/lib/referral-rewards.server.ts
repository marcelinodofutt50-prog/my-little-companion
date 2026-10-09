import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Processes the referral reward only after fulfillment has marked the order paid.
 * The database RPC creates an idempotent grant and snapshots absolute expiry
 * targets, so retrying a webhook never adds the same 3 days twice.
 */
export async function grantReferralPurchaseReward(
  supabaseAdmin: SupabaseClient,
  orderId: string,
): Promise<{ ok: boolean; reason: string }> {
  const { data, error } = await (supabaseAdmin as any).rpc("prepare_referral_purchase_reward", { p_order_id: orderId });
  if (error) throw new Error("Não foi possível preparar a recompensa de indicação.");

  const result = data as unknown as {
    ok?: boolean;
    reason?: string;
    grant_id?: string;
    status?: string;
    targets?: Array<{
      id: string;
      target_expires_at: string;
      panel: "v455" | "v457" | "v46" | null;
      yaarsa_email: string | null;
      synced: boolean;
    }>;
  };

  if (!result?.ok) return { ok: true, reason: result?.reason ?? "not-eligible" };

  const targets = result.targets ?? [];
  if (!targets.length) {
    // Preserve the grant as pending; do not claim the reward was delivered.
    return { ok: true, reason: "pending-no-active-license" };
  }

  const { yaarsaExtend } = await import("@/lib/yaarsa.server");
  for (const target of targets) {
    if (target.synced) continue;
    if (!target.yaarsa_email || !target.panel) {
      throw new Error("A licença indicada não possui dados suficientes para sincronizar a validade.");
    }

    const date = new Date(target.target_expires_at);
    if (Number.isNaN(date.getTime())) throw new Error("Data de validade da recompensa inválida.");
    const panelDate = date.toISOString().slice(0, 10);
    const response = await yaarsaExtend(target.yaarsa_email, panelDate, target.panel);
    if (response?.Fail) throw new Error("O painel recusou a extensão da licença indicada.");

    const { data: marked, error: markError } = await (supabaseAdmin as any).rpc("mark_referral_reward_license_synced", { p_target_id: target.id });
    if (markError || marked !== true) {
      // The next webhook retry will re-apply the same absolute panel expiry.
      throw new Error("Não foi possível confirmar a sincronização da recompensa.");
    }
  }

  return { ok: true, reason: "referral-reward-processed" };
}
