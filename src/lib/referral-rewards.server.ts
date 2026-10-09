import { calculateRewardExpiry, BUYER_REFERRAL_BONUS_DAYS, REFERRER_PURCHASE_REWARD_DAYS, isReferralRewardEligible } from "@/lib/referral-rewards";

type RewardRole = "referrer" | "buyer";

export async function grantReferralPurchaseRewards(orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id,user_id,referrer_id,status,plan_slug,metadata")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order || !isReferralRewardEligible(order as any)) return { ok: false, skipped: true };

  const { data: plan } = await supabaseAdmin.from("plans").select("category").eq("slug", order.plan_slug).maybeSingle();
  if (plan?.category === "server") return { ok: false, skipped: true };

  const roles: Array<{ role: RewardRole; userId: string; days: number }> = [
    { role: "referrer", userId: order.referrer_id!, days: REFERRER_PURCHASE_REWARD_DAYS },
    { role: "buyer", userId: order.user_id, days: BUYER_REFERRAL_BONUS_DAYS },
  ];

  const results = [];
  for (const reward of roles) results.push(await grantOne(supabaseAdmin, order, reward));
  return { ok: results.every((r) => r.ok), results };
}

async function grantOne(
  admin: any,
  order: { id: string; user_id: string; referrer_id: string | null; plan_slug: string; metadata: any },
  reward: { role: RewardRole; userId: string; days: number },
) {
  const { error: insertError } = await admin.from("referral_purchase_rewards").upsert(
    {
      order_id: order.id,
      user_id: reward.userId,
      beneficiary_role: reward.role,
      days: reward.days,
      status: "pending",
    },
    { onConflict: "order_id,beneficiary_role", ignoreDuplicates: true },
  );
  if (insertError) {
    await logRewardError(admin, order.id, reward.role, "ledger-write-failed");
    return { ok: false, reason: "ledger-write-failed" };
  }

  const { data: ledger, error: ledgerError } = await admin
    .from("referral_purchase_rewards")
    .select("id,status,license_id,previous_expires_at,granted_expires_at")
    .eq("order_id", order.id)
    .eq("beneficiary_role", reward.role)
    .maybeSingle();
  if (ledgerError || !ledger) return { ok: false, reason: "ledger-read-failed" };
  if (ledger.status === "granted" || ledger.status === "skipped") return { ok: true, duplicate: true };

  let license: any = null;
  if (reward.role === "buyer") {
    const { data } = await admin.from("licenses")
      .select("id,user_id,plan_slug,expires_at,yaarsa_email,panel,is_trial,disabled_at,revoked")
      .eq("order_id", order.id).eq("user_id", order.user_id)
      .is("disabled_at", null).maybeSingle();
    license = data;
  } else {
    const { data } = await admin.from("licenses")
      .select("id,user_id,plan_slug,expires_at,yaarsa_email,panel,is_trial,disabled_at,revoked")
      .eq("user_id", reward.userId).eq("is_trial", false).is("disabled_at", null)
      .eq("revoked", false).not("expires_at", "is", null)
      .order("expires_at", { ascending: true }).limit(10);
    license = (data ?? []).find((row: any) =>
      row.plan_slug !== "login-lifetime" &&
      !String(row.plan_slug ?? "").toLowerCase().includes("lifetime") &&
      row.expires_at && new Date(row.expires_at).getTime() > 0
    ) ?? null;
  }

  if (!license || license.is_trial || !license.expires_at || String(license.plan_slug).toLowerCase().includes("lifetime")) {
    await admin.from("referral_purchase_rewards")
      .update({ status: "skipped", note: "no-eligible-expiring-license" })
      .eq("id", ledger.id).eq("status", "pending");
    return { ok: true, skipped: true, reason: "no-eligible-expiring-license" };
  }

  // Persist a deterministic target expiry before touching the external license panel.
  // Retries reuse this timestamp, so webhook retries cannot add the days twice.
  let targetExpiry = ledger.granted_expires_at as string | null;
  let previousExpiry = ledger.previous_expires_at as string | null;
  if (!targetExpiry) {
    previousExpiry = license.expires_at;
    targetExpiry = calculateRewardExpiry(license.expires_at, reward.days);
    const { error: prepareError } = await admin.from("referral_purchase_rewards")
      .update({
        license_id: license.id,
        previous_expires_at: previousExpiry,
        granted_expires_at: targetExpiry,
        note: null,
      })
      .eq("id", ledger.id).eq("status", "pending");
    if (prepareError) return { ok: false, reason: "ledger-prepare-failed" };
  }

  // Never shorten an expiry if a renewal happened after the reward was prepared.
  const effectiveExpiry = new Date(license.expires_at) > new Date(targetExpiry)
    ? calculateRewardExpiry(license.expires_at, reward.days)
    : targetExpiry;
  if (effectiveExpiry !== targetExpiry) {
    targetExpiry = effectiveExpiry;
    await admin.from("referral_purchase_rewards")
      .update({ previous_expires_at: license.expires_at, granted_expires_at: targetExpiry })
      .eq("id", ledger.id).eq("status", "pending");
  }

  const { error: updateError } = await admin.from("licenses")
    .update({ expires_at: targetExpiry, revoked: false, status: "active" } as any)
    .eq("id", license.id).eq("user_id", reward.userId);
  if (updateError) {
    await logRewardError(admin, order.id, reward.role, "license-update-failed");
    return { ok: false, reason: "license-update-failed" };
  }

  if (license.yaarsa_email) {
    try {
      const { setExpiryAnyPanel } = await import("@/lib/license-cron.server");
      const panelResult = await setExpiryAnyPanel(license.yaarsa_email, license.panel ?? null, targetExpiry);
      if (panelResult.status !== "done") {
        await admin.from("referral_purchase_rewards")
          .update({ note: "panel-sync-pending" }).eq("id", ledger.id).eq("status", "pending");
        await logRewardError(admin, order.id, reward.role, "panel-sync-pending");
        return { ok: false, reason: "panel-sync-pending" };
      }
    } catch {
      await admin.from("referral_purchase_rewards")
        .update({ note: "panel-sync-pending" }).eq("id", ledger.id).eq("status", "pending");
      await logRewardError(admin, order.id, reward.role, "panel-sync-pending");
      return { ok: false, reason: "panel-sync-pending" };
    }
  }

  const { error: finishError } = await admin.from("referral_purchase_rewards")
    .update({ status: "granted", granted_at: new Date().toISOString(), note: null })
    .eq("id", ledger.id).eq("status", "pending");
  if (finishError) return { ok: false, reason: "ledger-finalize-failed" };

  const { data: referralRow } = await admin.from("referrals")
    .select("id")
    .eq("referrer_id", order.referrer_id)
    .eq("referred_id", order.user_id)
    .maybeSingle();
  if (referralRow?.id) {
    await admin.from("referrals")
      .update({ status: "converted", reward_status: "granted" } as any)
      .eq("id", referralRow.id);
    await admin.from("referral_events").insert({
      referral_id: referralRow.id,
      event_type: "purchase_reward_granted",
      metadata: { order_id: order.id, beneficiary_role: reward.role, days: reward.days },
    } as any);
  }
  return { ok: true, days: reward.days, expiresAt: targetExpiry };
}

async function logRewardError(admin: any, orderId: string, role: RewardRole, reason: string) {
  await admin.from("integration_logs").insert({
    source: "referrals",
    action: "purchase_reward",
    outcome: "partial",
    error: reason,
    context: { order_id: orderId, beneficiary_role: role } as any,
  });
}
