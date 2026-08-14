import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Backoff exponencial das tentativas de entrega automática.
// 1ª falha → 1 min, depois 2, 4, 8, 16, 32 e teto de 60 min.
export function fulfillmentBackoffMs(attempt: number) {
  const minutes = Math.min(60, Math.pow(2, Math.max(0, attempt - 1)));
  return minutes * 60 * 1000;
}

// Máximo de tentativas automáticas antes de marcar para intervenção manual.
export const MAX_FULFILLMENT_ATTEMPTS = 12;

// Wrapper: guarantees an order never stays stuck in "processing" when an
// unexpected error (Yaarsa timeout, network failure) aborts fulfillment.
export async function fulfillOrder(orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const result = await fulfillOrderInner(orderId);
    if (result.ok) {
      // Sucesso: zera o contador de tentativas.
      await supabaseAdmin
        .from("orders")
        .update({ fulfillment_attempts: 0, next_retry_at: null, last_fulfillment_error: null } as any)
        .eq("id", orderId);
    } else if (!["in-progress", "already-fulfilled", "already-renewed"].includes((result as any).reason ?? "")) {
      await scheduleFulfillmentRetry(orderId, (result as any).reason ?? "unknown");
    }
    return result;
  } catch (e: any) {
    const message = e?.message ?? String(e);
    await supabaseAdmin
      .from("orders")
      .update({ status: "pending", processing_at: null } as any)
      .eq("id", orderId)
      .eq("status", "processing");
    await scheduleFulfillmentRetry(orderId, message);
    await supabaseAdmin.from("webhook_logs").insert({
      source: "fulfillment",
      note: `order ${orderId} error, released for retry: ${message}`,
      processed: false,
    });
    return { ok: false, reason: `error: ${message}` };
  }
}

// Incrementa o contador e agenda a próxima tentativa com backoff exponencial.
async function scheduleFulfillmentRetry(orderId: string, error: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("orders")
    .select("fulfillment_attempts")
    .eq("id", orderId)
    .maybeSingle();
  const attempts = Number((row as any)?.fulfillment_attempts ?? 0) + 1;
  const patch: Record<string, unknown> = {
    fulfillment_attempts: attempts,
    last_fulfillment_error: error.slice(0, 500),
    next_retry_at: new Date(Date.now() + fulfillmentBackoffMs(attempts)).toISOString(),
  };
  if (attempts >= MAX_FULFILLMENT_ATTEMPTS) {
    patch["status"] = "yaarsa_failed";
    patch["next_retry_at"] = null;
    await supabaseAdmin.from("webhook_logs").insert({
      source: "fulfillment",
      note: `order ${orderId} esgotou ${attempts} tentativas automáticas: ${error}`,
      processed: false,
    });
  }
  await supabaseAdmin.from("orders").update(patch as any).eq("id", orderId);
  return attempts;
}

async function fulfillOrderInner(orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { yaarsaCreateAccount, generateCredentials, encrypt } = await import("@/lib/yaarsa.server");

  // Release orders stuck in "processing" for more than 10 minutes so a webhook
  // retry can safely pick them up again.
  const staleCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from("orders")
    .update({ status: "pending" } as any)
    .eq("id", orderId)
    .eq("status", "processing")
    .lt("processing_at", staleCutoff);


  // Atomic claim: only proceed if not already paid. Prevents duplicate fulfillment on concurrent webhooks.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("orders")
    .update({ status: "processing", processing_at: new Date().toISOString() } as any)
    .eq("id", orderId)
    .in("status", ["pending", "created", "yaarsa_failed"])
    .select("*")
    .maybeSingle();

  if (claimErr) return { ok: false, reason: `claim-error: ${claimErr.message}` };


  if (!claimed) {
    // Already paid/processing — verify a license/renewal actually landed; if yes, idempotent success.
    const { data: order } = await supabaseAdmin.from("orders").select("status,plan_slug").eq("id", orderId).maybeSingle();
    if (!order) return { ok: false, reason: "order-not-found" };
    const { data: plan } = await supabaseAdmin.from("plans").select("category").eq("slug", order.plan_slug).maybeSingle();
    if (plan?.category === "server") {
      if (order.status === "paid") return { ok: true, reason: "already-renewed" };
      if (order.status === "processing") return { ok: true, reason: "in-progress" };
      return { ok: false, reason: `not-claimable: ${order.status}` };
    }
    const { data: has } = await supabaseAdmin.from("licenses").select("id").eq("order_id", orderId).maybeSingle();
    if (has) return { ok: true, reason: "already-fulfilled" };
    if (order.status === "processing") return { ok: true, reason: "in-progress" };
    return { ok: false, reason: `not-claimable: ${order.status}` };
  }

  const order = claimed;

  // Presente: quando o pedido tem gift, a licença/renovação vai para a conta
  // do presenteado; cashback e indicação continuam com quem pagou.
  const giftMeta = (order as any).metadata?.gift as
    | { recipient_id: string; email: string; message: string | null; from: string | null }
    | undefined;
  const beneficiaryId: string = giftMeta?.recipient_id ?? order.user_id;

  // Look up plan category — server-renewal orders don't create a new license.
  const { data: planRow } = await supabaseAdmin.from("plans").select("category, slug").eq("slug", order.plan_slug).maybeSingle();

  // Server renewal cycle: every plan aligns to the next 20th of the month.
  const nextDay20 = (() => {
    const d = new Date();
    const target = new Date(d.getFullYear(), d.getMonth(), 20, 23, 59, 59);
    if (d.getDate() >= 20) target.setMonth(target.getMonth() + 1);
    return target;
  })();

  // ============ Upgrade v4.5.7 → v4.6 path ============
  if (planRow?.category === "upgrade" && planRow?.slug === "upgrade-457-to-46") {
    const { yaarsaCreateAccount, yaarsaExtend, generateCredentials, encrypt } = await import("@/lib/yaarsa.server");
    const ymd = nextDay20.toISOString().slice(0, 10);

    // Find the old v457 license (either from metadata or a fresh lookup).
    const upgradeMeta = (order as any).metadata?.upgrade as { from_license_id: string | null } | undefined;
    let oldLicenseId = upgradeMeta?.from_license_id ?? null;
    if (!oldLicenseId) {
      const { data: fallback } = await supabaseAdmin
        .from("licenses").select("id").eq("user_id", order.user_id).eq("panel", "v457")
        .is("disabled_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      oldLicenseId = fallback?.id ?? null;
    }

    // Create new v4.6 account with fresh random credentials.
    const creds = generateCredentials();
    let yr = await yaarsaCreateAccount({
      username: creds.username, email: creds.email, password: creds.password,
      planSlug: "login-lifetime", totalPaid: Number(order.amount),
      additionalInfo: `shadow-upgrade-${order.id}`, panel: "v46",
    });
    // Retry once with a fresh email if collision.
    if (yr.Fail && /1004|already|exist/i.test(yr.Fail)) {
      const retry = generateCredentials();
      yr = await yaarsaCreateAccount({
        username: retry.username, email: retry.email, password: retry.password,
        planSlug: "login-lifetime", totalPaid: Number(order.amount),
        additionalInfo: `shadow-upgrade-${order.id}-r`, panel: "v46",
      });
      if (!yr.Fail) Object.assign(creds, retry);
    }
    if (yr.Fail) {
      await supabaseAdmin.from("orders").update({ status: "yaarsa_failed" }).eq("id", orderId);
      await supabaseAdmin.from("webhook_logs").insert({
        source: "yaarsa", note: `upgrade order ${orderId} failed: ${yr.Fail}`, processed: false,
      });
      return { ok: false, reason: yr.Fail };
    }

    // Align v46 expiry to the next day-20 cycle.
    try { await yaarsaExtend(creds.email, ymd, "v46"); } catch { /* best-effort */ }

    // Insert the new v4.6 license (lifetime tier — expires 20 years out).
    const lifetimeExpiry = new Date(); lifetimeExpiry.setFullYear(lifetimeExpiry.getFullYear() + 20);
    const { data: newLic } = await supabaseAdmin.from("licenses").insert({
      user_id: order.user_id,
      order_id: order.id,
      plan_slug: "login-lifetime",
      yaarsa_username: creds.username,
      yaarsa_email: creds.email,
      yaarsa_password_enc: encrypt(creds.password),
      expires_at: lifetimeExpiry.toISOString(),
      server_paid_until: nextDay20.toISOString(),
      is_trial: false,
      version_tier: "lifetime_46",
      is_legacy: true,
      panel: "v46",
      upgraded_from_license_id: oldLicenseId,
      server_ip: await (await import("@/lib/yaarsa.server")).resolvePanelServerHost("v46"),
    } as any).select("id, yaarsa_email").single();

    // Disable the old v4.5.7 license (DB + best-effort on the old panel).
    if (oldLicenseId) {
      const { data: oldLic } = await supabaseAdmin
        .from("licenses").select("yaarsa_email").eq("id", oldLicenseId).maybeSingle();
      await supabaseAdmin.from("licenses").update({
        disabled_at: new Date().toISOString(), revoked: true,
      }).eq("id", oldLicenseId);
      if (oldLic?.yaarsa_email) {
        // Push expiry to the past on v457 so the old login stops working.
        try { await yaarsaExtend(oldLic.yaarsa_email, "2000-01-01", "v457"); } catch { /* best-effort */ }
      }
    }

    // Reflect that the user is now on v46 too.
    await supabaseAdmin.from("profiles").update({
      legacy_status: "both",
      legacy_checked_at: new Date().toISOString(),
    }).eq("id", order.user_id);

    await supabaseAdmin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);
    await supabaseAdmin.from("integration_logs").insert({
      source: "upgrade", action: "v457_to_v46", outcome: "success",
      context: { order_id: order.id, user_id: order.user_id, new_license_id: newLic?.id, from_license_id: oldLicenseId, new_email: newLic?.yaarsa_email } as any,
    });
    return { ok: true, reason: `upgrade:${newLic?.id ?? "unknown"}` };
  }

  // ============ Server renewal path ============
  if (planRow?.category === "server") {
    const { yaarsaExtend } = await import("@/lib/yaarsa.server");
    const ymd = nextDay20.toISOString().slice(0, 10);
    const legacyClaim = (order as any).metadata?.legacy_claim as
      | { email: string; password_enc: string; ip: string; panel: "v457" | "v46" }
      | undefined;

    // ---- Legacy-claim renewal: provision the license row for the old client on first payment ----
    if (legacyClaim) {
      const emailLower = legacyClaim.email.toLowerCase();
      const { data: existing } = await supabaseAdmin
        .from("licenses").select("id").eq("user_id", order.user_id).eq("yaarsa_email", emailLower).maybeSingle();

      let licenseId = existing?.id as string | undefined;
      if (!licenseId) {
        const versionTier = legacyClaim.panel === "v46" ? "lifetime_46" : "monthly_457";
        const planSlug = legacyClaim.panel === "v46" ? "login-lifetime" : "login-30d";
        const usernameGuess = emailLower.split("@")[0].slice(0, 16);
        const { data: newLic } = await supabaseAdmin.from("licenses").insert({
          user_id: order.user_id,
          plan_slug: planSlug,
          yaarsa_username: usernameGuess,
          yaarsa_email: emailLower,
          yaarsa_password_enc: legacyClaim.password_enc,
          server_ip: legacyClaim.ip,
          expires_at: nextDay20.toISOString(),
          server_paid_until: nextDay20.toISOString(),
          is_trial: false,
          is_legacy: true,
          legacy_server_fee_brl: 250,
          version_tier: versionTier,
          panel: legacyClaim.panel,
          order_id: order.id,
        } as any).select("id").single();
        licenseId = newLic?.id;
        await supabaseAdmin.from("integration_logs").insert({
          source: `yaarsa-${legacyClaim.panel}`, action: "legacy_renewal_provision", outcome: "success",
          context: { user_id: order.user_id, email: emailLower, order_id: order.id, license_id: licenseId } as any,
        });
      }

      try { await yaarsaExtend(emailLower, ymd, legacyClaim.panel); } catch { /* best-effort */ }
      if (licenseId) {
        await supabaseAdmin.from("licenses").update({
          server_paid_until: nextDay20.toISOString(),
          expires_at: nextDay20.toISOString(),
          revoked: false,
          server_overdue_at: null,
          server_ip: legacyClaim.ip,
        }).eq("id", licenseId);
      }
      await supabaseAdmin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);
      await supabaseAdmin.from("webhook_logs").insert({
        source: "mercadopago", note: `legacy server renewal ${orderId} — provisioned ${!existing}`, processed: true,
      });
      return { ok: true, reason: `legacy-renewal:${licenseId ?? "unknown"}` };
    }

    // Reactivate every server-overdue license for this user (uses SQL fn),
    // then also extend any active license belonging to the user so the whole
    // account stays paid until next day 20.
    const { data: reactivated } = await supabaseAdmin
      .rpc("reactivate_server_licenses_for_user", { _user_id: beneficiaryId, _paid_until: nextDay20.toISOString() });

    const { data: activeLics } = await supabaseAdmin
      .from("licenses").select("*")
      .eq("user_id", beneficiaryId).eq("is_trial", false).is("disabled_at", null);

    const touched = [
      ...(reactivated ?? []),
      ...(activeLics ?? []).filter((l: any) => !(reactivated ?? []).some((r: any) => r.id === l.id)),
    ];

    for (const l of touched) {
      try { await yaarsaExtend(l.yaarsa_email, ymd, (l as any).panel ?? "v457"); } catch { /* best-effort */ }
      await supabaseAdmin.from("licenses").update({
        server_paid_until: nextDay20.toISOString(),
        expires_at: l.expires_at && new Date(l.expires_at) > nextDay20 ? l.expires_at : nextDay20.toISOString(),
        revoked: false,
        server_overdue_at: null,
      }).eq("id", l.id);
    }

    await supabaseAdmin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);
    await supabaseAdmin.from("webhook_logs").insert({
      source: "mercadopago", note: `server renewal ${orderId} — ${touched.length} license(s) extended`, processed: true,
    });
    return { ok: true, reason: `server-renewal:${touched.length}` };
  }

  // ============ Market product path (admin fulfills manually via support/chat) ============
  if (planRow?.category === "market") {
    await supabaseAdmin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);
    await supabaseAdmin.from("webhook_logs").insert({
      source: "mercadopago", note: `market purchase ${orderId} paid (${planRow.slug}) — aguardando entrega admin`, processed: true,
    });
    return { ok: true, reason: `market:${planRow.slug}` };
  }

  // ============ New-license path (default: login plans) ============
  const { resolvePanelFromPlanSlug } = await import("@/lib/yaarsa.server");
  const targetPanel = await resolvePanelFromPlanSlug(order.plan_slug);
  const creds = generateCredentials();
  const yr = await yaarsaCreateAccount({
    username: creds.username,
    email: creds.email,
    password: creds.password,
    planSlug: order.plan_slug,
    totalPaid: Number(order.amount),
    additionalInfo: `shadow-order-${order.id}`,
    panel: targetPanel,
  });
  if (yr.Fail) {
    await supabaseAdmin.from("orders").update({ status: "yaarsa_failed" }).eq("id", orderId);
    await supabaseAdmin.from("webhook_logs").insert({
      source: "yaarsa", note: `order ${orderId} failed: ${yr.Fail}`, processed: false,
    });
    return { ok: false, reason: yr.Fail };
  }

  let expiresAt: Date;
  if (order.plan_slug === "login-7d") {
    expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
  } else if (order.plan_slug === "login-lifetime") {
    // Vitalício real: 20 anos
    expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 20);
  } else if (order.plan_slug === "login-30d") {
    // Mensal: 30 dias exatos para não haver perda de dias na ativação
    expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 30);
  } else {
    // Qualquer outro plano pago por dias: 30 dias a partir da compra.
    expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 30);
  }

  // Re-align Yaarsa expire_date to match our billing cycle
  const ymd = expiresAt.toISOString().slice(0, 10);
  const { yaarsaExtend } = await import("@/lib/yaarsa.server");
  await yaarsaExtend(creds.email, ymd, targetPanel);

  const { tierFromPlanSlug } = await import("@/lib/plans");
  const versionTier = tierFromPlanSlug(order.plan_slug);
  const { resolvePanelServerHost } = await import("@/lib/yaarsa.server");
  const serverIpForPanel = await resolvePanelServerHost(targetPanel);

  // Se o pedido incluiu servidor antecipado, garantimos que a licença reflita isso
  // (Embora na prática o fulfillment já cuide da extensão via yaarsaExtend acima)
  const meta = (order as any).metadata;
  const includeServer = !!meta?.includeServer || order.plan_slug.includes("server");

  const { data: createdLicense, error: licenseError } = await supabaseAdmin.from("licenses").insert({
    user_id: beneficiaryId,
    order_id: order.id,
    plan_slug: order.plan_slug,
    yaarsa_username: creds.username,
    yaarsa_email: creds.email,
    yaarsa_password_enc: encrypt(creds.password),
    expires_at: expiresAt.toISOString(),
    server_paid_until: nextDay20.toISOString(),
    is_trial: false,
    version_tier: versionTier,
    is_legacy: false,
    panel: targetPanel,
    server_ip: serverIpForPanel,
    status: 'active',
    origin_type: 'purchase',
    metadata: { order_id: order.id, buyer_id: order.user_id }
  } as any).select("id").single();
  if (licenseError || !createdLicense) {
    throw new Error(`Falha ao registrar licença: ${licenseError?.message ?? "sem retorno"}`);
  }

  // Auto-deliver credentials in the customer's support chat as a system message.
  // Warning: If user already had a trial login and bought a weekly/monthly login,
  // we are creating a SECOND login (new credentials). 
  try {
    const { data: openThread } = await supabaseAdmin
      .from("support_threads")
      .select("id")
      .eq("user_id", beneficiaryId)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let threadId = openThread?.id as string | undefined;
    if (!threadId) {
      const { data: nt } = await supabaseAdmin
        .from("support_threads")
        .insert({ user_id: beneficiaryId, subject: giftMeta ? "Você recebeu um presente 🎁" : "Entrega automática", status: "open" })
        .select("id").single();
      threadId = nt?.id;
    }
    if (threadId) {
      const serverLabel = targetPanel === "v46" ? "Shadow 4.6" : targetPanel === "v455" ? "Shadow 4.5.5" : "Shadow 4.5.7";
      const giftHeader = giftMeta
        ? `🎁 *Você recebeu um presente${giftMeta.from ? ` de ${giftMeta.from}` : ""}!*${giftMeta.message ? `\n\n_"${giftMeta.message}"_` : ""}\n`
        : "";
      const body = giftHeader +
`✅ *Pagamento confirmado — obrigado pela preferência!*

Aqui estão suas credenciais de acesso:

• Servidor: *${serverLabel}* (${serverIpForPanel})
• Usuário: \`${creds.username}\`
• Email: \`${creds.email}\`
• Senha: \`${creds.password}\`
• Validade: ${expiresAt.toLocaleDateString("pt-BR")}

Guarde essas informações. Você também pode consultá-las a qualquer momento no seu painel em /dashboard.`;
      await supabaseAdmin.from("support_messages").insert({
        thread_id: threadId,
        sender_id: beneficiaryId,
        is_admin: true,
        is_system: true,
        body,
      });
    }
  } catch (e: any) {
    await supabaseAdmin.from("integration_logs").insert({
      source: "support", action: "auto_deliver_credentials", outcome: "error",
      error: e?.message ?? "unknown", context: { order_id: order.id } as any,
    } as any);
  }

  // Confirma pro comprador que o presente foi entregue.
  if (giftMeta) {
    try {
      const { data: buyerThread } = await supabaseAdmin
        .from("support_threads").select("id").eq("user_id", order.user_id)
        .neq("status", "closed").order("created_at", { ascending: false }).limit(1).maybeSingle();
      let bt = buyerThread?.id as string | undefined;
      if (!bt) {
        const { data: nt } = await supabaseAdmin.from("support_threads")
          .insert({ user_id: order.user_id, subject: "Presente enviado 🎁", status: "open" })
          .select("id").single();
        bt = nt?.id;
      }
      if (bt) {
        await supabaseAdmin.from("support_messages").insert({
          thread_id: bt, sender_id: order.user_id, is_admin: true, is_system: true,
          body: `🎁 *Presente entregue!*\n\nO acesso que você comprou já foi liberado na conta de *${giftMeta.email}*. Por segurança, as credenciais aparecem só no painel de quem recebeu.`,
        });
      }
    } catch { /* best-effort */ }
  }

  await supabaseAdmin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);

  // ============ Débito do cashback usado ============
  // Sem esta baixa o saldo nunca é consumido e o mesmo cashback vira desconto infinito.
  const usedCashback = Number(order.cashback_used ?? 0);
  if (usedCashback > 0) {
    const { data: alreadyDebited } = await supabaseAdmin
      .from("cashback_ledger").select("id")
      .eq("order_id", order.id).lt("amount", 0).maybeSingle();
    if (!alreadyDebited) {
      await supabaseAdmin.from("cashback_ledger").insert({
        user_id: order.user_id, order_id: order.id, amount: -usedCashback,
        reason: `Cashback utilizado no pedido ${order.id.slice(0, 8)}`,
      });
    }
  }

  if (order.coupon_code) {
    const { data: coupon } = await supabaseAdmin.from("coupons").select("*").eq("code", order.coupon_code).maybeSingle();
    const { count: paidBefore } = await supabaseAdmin.from("orders")
      .select("*", { count: "exact", head: true })
      .eq("user_id", order.user_id).eq("status", "paid").neq("id", order.id);
    if (coupon && coupon.cashback_pct > 0 && (paidBefore ?? 0) === 0) {
      const credit = Number(order.amount) * (coupon.cashback_pct / 100);
      await supabaseAdmin.from("cashback_ledger").insert({
        user_id: order.user_id, order_id: order.id, amount: credit,
        reason: `Cashback ${coupon.cashback_pct}% cupom ${coupon.code}`,
      });
      await supabaseAdmin.from("orders").update({ cashback_credited: credit }).eq("id", order.id);
    }
    // Consome uma unidade do cupom limitado (e desativa quando zerar).
    if (coupon && coupon.uses_left !== null && coupon.uses_left !== undefined) {
      const left = Math.max(0, Number(coupon.uses_left) - 1);
      await supabaseAdmin.from("coupons")
        .update({ uses_left: left, ...(left === 0 ? { active: false } : {}) })
        .eq("code", coupon.code);
    }
  }


  // ============ Referral reward ============
  // Grant reward to the referrer if this is the referred user's FIRST paid order.
  if (order.referrer_id && order.referrer_id !== order.user_id) {
    try {
      const { count: paidBefore } = await supabaseAdmin.from("orders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", order.user_id).eq("status", "paid").neq("id", order.id);
      const { data: existingRef } = await supabaseAdmin
        .from("referrals").select("id").eq("referred_id", order.user_id).maybeSingle();

      if ((paidBefore ?? 0) === 0 && !existingRef) {
        const { data: refProfile } = await supabaseAdmin
          .from("profiles").select("referral_reward_pref, pix_key").eq("id", order.referrer_id).maybeSingle();
        const pref = (refProfile?.referral_reward_pref as "cashback" | "free_month" | "pix") || "cashback";
        const REWARD_AMOUNT = 150;
        let status: "granted" | "pending" = "pending";
        let notes: string | null = null;

        if (pref === "cashback") {
          await supabaseAdmin.from("cashback_ledger").insert({
            user_id: order.referrer_id,
            order_id: order.id,
            amount: REWARD_AMOUNT,
            reason: `Indicação — usuário ${order.user_id.slice(0, 8)}`,
          });
          status = "granted";
        } else if (pref === "free_month") {
          // Extend all active licenses by 30 days
          const { data: licenses } = await supabaseAdmin
            .from("licenses").select("id, expires_at")
            .eq("user_id", order.referrer_id).eq("revoked", false);
          for (const l of licenses ?? []) {
            const base = l.expires_at ? new Date(l.expires_at) : new Date();
            base.setDate(base.getDate() + 30);
            await supabaseAdmin.from("licenses").update({ expires_at: base.toISOString() }).eq("id", l.id);
          }
          status = "granted";
          notes = `Estendidas ${licenses?.length ?? 0} licença(s) em 30 dias`;
        } else {
          // pix — admin needs to pay manually
          status = "pending";
          notes = "Aguardando pagamento manual do PIX";
        }

        await supabaseAdmin.from("referrals").insert({
          referrer_id: order.referrer_id,
          referred_id: order.user_id,
          order_id: order.id,
          reward_type: pref,
          reward_amount: REWARD_AMOUNT,
          reward_status: status,
          pix_key: pref === "pix" ? refProfile?.pix_key ?? null : null,
          notes,
        } as any);
      }
    } catch (e: any) {
      await supabaseAdmin.from("integration_logs").insert({
        source: "referral", action: "grant_reward", outcome: "error",
        error: e?.message ?? "unknown", context: { order_id: order.id, referrer_id: order.referrer_id } as any,
      } as any);
    }
  }

  return { ok: true };
}


/**
 * Validates Mercado Pago webhook signature.
 * Header: x-signature: "ts=TIMESTAMP,v1=HASH"
 * Manifest: `id:DATA_ID;request-id:REQUEST_ID;ts:TIMESTAMP;`
 * HMAC-SHA256(manifest, MP_WEBHOOK_SECRET) === HASH
 */
function verifyMpSignature(request: Request, dataId: string | null, secret: string): boolean {
  const sigHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id") ?? "";
  if (!sigHeader || !dataId) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  // Reject stale timestamps (>10 min) to prevent replay
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const nowMs = Date.now();
  const tsMs = tsNum > 1e12 ? tsNum : tsNum * 1000;
  if (Math.abs(nowMs - tsMs) > 10 * 60 * 1000) return false;

  // MP lowercases alphanumeric ids in the manifest, and omits parts whose
  // header is absent. Accept every documented variant instead of one shape.
  const ids = Array.from(new Set([dataId, dataId.toLowerCase()]));
  const manifests: string[] = [];
  for (const id of ids) {
    if (requestId) manifests.push(`id:${id};request-id:${requestId};ts:${ts};`);
    manifests.push(`id:${id};ts:${ts};`);
    manifests.push(`id:${id};request-id:;ts:${ts};`);
  }

  let given: Buffer;
  try {
    given = Buffer.from(v1, "hex");
  } catch {
    return false;
  }
  return manifests.some((manifest) => {
    const expected = Buffer.from(createHmac("sha256", secret).update(manifest).digest("hex"), "hex");
    if (expected.length !== given.length) return false;
    try {
      return timingSafeEqual(expected, given);
    } catch {
      return false;
    }
  });
}

export const Route = createFileRoute("/api/public/mp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getMpPayment } = await import("@/lib/mercadopago.server");
        const url = new URL(request.url);
        let bodyText = "";
        try { bodyText = await request.text(); } catch {}
        let payload: Record<string, unknown> = {};
        try { payload = JSON.parse(bodyText || "{}"); } catch {}

        const type = (payload.type as string) || (payload.topic as string) || url.searchParams.get("type") || url.searchParams.get("topic");
        const nested = (payload.data as { id?: string } | undefined)?.id;
        const dataId = nested || url.searchParams.get("data.id") || url.searchParams.get("id");

        // Signature validation. When it fails we do NOT trust the request body:
        // we only continue by asking Mercado Pago's API (with our own access
        // token) whether that payment id exists and is approved. That is
        // authoritative, so a wrong/rotated webhook secret can never again
        // block a real delivery, and a forged request still can't grant a
        // license because MP would not confirm it.
        const secret = process.env['MP_WEBHOOK_SECRET'];
        const valid = secret ? verifyMpSignature(request, dataId ? String(dataId) : null, secret) : false;

        if (!valid) {
          // If signature is invalid or secret is missing, we STILL try to validate via API fallback.
          // This ensures that even if HMAC fails (e.g. secret mismatch or rotation), we verify with MP directly.
          // However, we log it clearly to monitor potential fraud or misconfiguration.
          await supabaseAdmin.from("webhook_logs").insert({
            source: "mercadopago",
            note: secret 
              ? `Invalid HMAC signature (dataId=${dataId ?? "?"}) — performing authoritative API fallback validation`
              : `Webhook secret not configured (dataId=${dataId ?? "?"}) — using authoritative API validation`,
            processed: false,
          });
          // We do NOT return 401 anymore; we proceed to authoritative API check.
        }


        await supabaseAdmin.from("webhook_logs").insert({
          source: "mercadopago", note: String(type ?? ""), payload: payload as any, processed: false,
        });

        if (!dataId || (type && !["payment", "payment.created", "payment.updated"].includes(String(type)))) {
          return new Response("ok", { status: 200 });
        }

        try {
          const payment = await getMpPayment(String(dataId));
          const orderId = payment.external_reference;
          if (!orderId) return new Response("ok", { status: 200 });

          // Idempotency: if this payment id was already recorded on a paid order, skip.
          const { data: existing } = await supabaseAdmin
            .from("orders")
            .select("id, status")
            .eq("mp_payment_id", String(payment.id))
            .eq("status", "paid")
            .maybeSingle();
          if (existing) {
            await supabaseAdmin.from("webhook_logs").insert({
              source: "mercadopago", note: `duplicate payment ${payment.id} ignored`, processed: true,
            });
            return new Response("ok", { status: 200 });
          }

          await supabaseAdmin.from("orders").update({ mp_payment_id: String(payment.id) }).eq("id", orderId);

          // Only fulfill for approved payments — pending/rejected/refunded never grants license.
          if (payment.status === "approved") {
            const result = await fulfillOrder(orderId);
            await supabaseAdmin.from("webhook_logs").insert({
              source: "fulfillment",
              note: `order ${orderId} → ${result.ok ? "ok" : "fail"}${(result as any).reason ? ` (${(result as any).reason})` : ""}`,
              processed: result.ok,
            });
          } else {
            await supabaseAdmin.from("webhook_logs").insert({
              source: "mercadopago",
              note: `payment ${payment.id} status=${payment.status} — no fulfillment`,
              processed: true,
            });
          }
        } catch (e: any) {
          console.error("[WebhookError]", e);
          await supabaseAdmin.from("webhook_logs").insert({
            source: "mercadopago", note: `error: ${e?.message || String(e)}`, processed: false,
          });
        }
        return new Response("ok", { status: 200 });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
