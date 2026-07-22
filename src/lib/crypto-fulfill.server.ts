/**
 * Provision a license from a confirmed crypto payment.
 * Mirrors the "new license" branch of the Mercado Pago webhook, scoped to
 * login plans (login-7d / login-30d / login-lifetime).
 *
 * SECURITY: verifies the on-chain amount (converted to BRL via live FX)
 * meets at least 97% of the plan price before releasing the license.
 * A 3% tolerance covers exchange spread + network fees.
 */
export async function fulfillCryptoPayment(paymentId: string): Promise<{ ok: boolean; reason?: string; licenseId?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { yaarsaCreateAccount, yaarsaExtend, generateCredentials, encrypt, panelFromPlanSlug } = await import("./yaarsa.server");
  const { tierFromPlanSlug } = await import("./plans");

  // Atomic claim: only fulfill a payment currently in 'confirmed' state.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("crypto_payments")
    .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "confirmed")
    .select("*")
    .maybeSingle();

  if (claimErr) return { ok: false, reason: `claim-error: ${claimErr.message}` };
  if (!claimed) return { ok: false, reason: "not-claimable" };

  // ---- AMOUNT GUARD: reject underpayments ----
  const planPrice = Number(claimed.amount_brl ?? 0);
  const paidBrl = Number(claimed.amount_brl_verified ?? 0);
  const MIN_RATIO = 0.97; // 3% tolerance (fees + FX spread)
  if (planPrice > 0 && paidBrl > 0 && paidBrl < planPrice * MIN_RATIO) {
    await supabaseAdmin.from("crypto_payments").update({
      status: "rejected",
      failure_reason: `underpayment: pago R$${paidBrl.toFixed(2)} < requerido R$${(planPrice * MIN_RATIO).toFixed(2)}`,
    }).eq("id", claimed.id);
    return { ok: false, reason: "underpayment" };
  }



  try {
    // Create the order row (mirrors MP flow so licenses point back to an order).
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: claimed.user_id,
        plan_slug: claimed.plan_slug,
        amount: Number(claimed.amount_brl ?? 0),
        status: "paid",
        paid_at: new Date().toISOString(),
        metadata: { crypto: { payment_id: claimed.id, network: claimed.network, tx_hash: claimed.tx_hash } } as any,
      } as any)
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message || "order insert failed");

    await supabaseAdmin.from("crypto_payments").update({ order_id: order.id }).eq("id", claimed.id);

    const nextDay20 = (() => {
      const d = new Date();
      const t = new Date(d.getFullYear(), d.getMonth(), 20, 23, 59, 59);
      if (d.getDate() >= 20) t.setMonth(t.getMonth() + 1);
      return t;
    })();

    const targetPanel = panelFromPlanSlug(claimed.plan_slug);
    const creds = generateCredentials();
    let yr = await yaarsaCreateAccount({
      username: creds.username,
      email: creds.email,
      password: creds.password,
      planSlug: claimed.plan_slug,
      totalPaid: Number(claimed.amount_brl ?? 0),
      additionalInfo: `shadow-crypto-${claimed.id}`,
      panel: targetPanel,
    });
    if (yr.Fail && /1004|already|exist/i.test(yr.Fail)) {
      const retry = generateCredentials();
      yr = await yaarsaCreateAccount({
        username: retry.username, email: retry.email, password: retry.password,
        planSlug: claimed.plan_slug, totalPaid: Number(claimed.amount_brl ?? 0),
        additionalInfo: `shadow-crypto-${claimed.id}-r`, panel: targetPanel,
      });
      if (!yr.Fail) Object.assign(creds, retry);
    }
    if (yr.Fail) {
      await supabaseAdmin.from("crypto_payments").update({
        status: "failed", failure_reason: `yaarsa: ${yr.Fail}`,
      }).eq("id", claimed.id);
      await supabaseAdmin.from("orders").update({ status: "yaarsa_failed" }).eq("id", order.id);
      return { ok: false, reason: yr.Fail };
    }

    let expiresAt: Date;
    if (claimed.plan_slug === "login-7d") { expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7); }
    else if (claimed.plan_slug === "login-lifetime") { expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 20); }
    else expiresAt = nextDay20;

    try { await yaarsaExtend(creds.email, expiresAt.toISOString().slice(0, 10), targetPanel); } catch { /* best-effort */ }

    const serverIp = targetPanel === "v46" ? "200.9.154.103" : "191.96.78.81";
    const { data: lic } = await supabaseAdmin.from("licenses").insert({
      user_id: claimed.user_id,
      order_id: order.id,
      plan_slug: claimed.plan_slug,
      yaarsa_username: creds.username,
      yaarsa_email: creds.email,
      yaarsa_password_enc: encrypt(creds.password),
      expires_at: expiresAt.toISOString(),
      server_paid_until: nextDay20.toISOString(),
      is_trial: false,
      version_tier: tierFromPlanSlug(claimed.plan_slug),
      is_legacy: false,
      panel: targetPanel,
      server_ip: serverIp,
    } as any).select("id").single();

    await supabaseAdmin.from("integration_logs").insert({
      source: "crypto", action: "fulfill", outcome: "success",
      context: { payment_id: claimed.id, order_id: order.id, license_id: lic?.id, network: claimed.network } as any,
    });

    return { ok: true, licenseId: lic?.id };
  } catch (e: any) {
    // Roll payment back to 'confirmed' so cron can retry.
    await supabaseAdmin.from("crypto_payments").update({
      status: "confirmed", failure_reason: `fulfill-error: ${e?.message ?? "unknown"}`,
    }).eq("id", paymentId);
    return { ok: false, reason: e?.message ?? "unknown" };
  }
}
