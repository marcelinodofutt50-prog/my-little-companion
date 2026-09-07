import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Revenda do parceiro: cadastro de clientes, criação de licenças (sincronizadas
 * com o painel), registro de pagamentos e histórico.
 *
 * Toda escrita passa por aqui e exige um acesso "reseller" ativo.
 */

const PLAN_DAYS: Record<string, number> = {
  "login-7d": 7,
  "login-30d": 30,
  "login-lifetime": 7300,
};

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function requireResellerPartner(context: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isEntitlementActive } = await import("@/lib/partner.server");
  const { data: ents } = await supabaseAdmin
    .from("partner_entitlements")
    .select("id, kind, status, expires_at")
    .eq("user_id", context.userId)
    .eq("kind", "reseller");
  const ent = (ents ?? []).find((e: any) => isEntitlementActive(e));
  if (!ent) return { admin: supabaseAdmin, error: "Você precisa de um servidor de revenda ativo para usar esta área." };
  return { admin: supabaseAdmin, entitlementId: (ent as any).id };
}

/** Tudo que a tela do parceiro precisa: clientes, licenças, pagamentos e resumo. */
export const getPartnerDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: customers }, { data: licenses }, { data: payments }] = await Promise.all([
      context.supabase
        .from("partner_customers" as any)
        .select("id, name, contact, notes, created_at")
        .eq("partner_id", context.userId)
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("partner_licenses" as any)
        .select(
          "id, customer_id, plan_slug, panel, panel_username, panel_email, status, expires_at, price_cents, paid, last_sync_at, sync_error, created_at",
        )
        .eq("partner_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("partner_payments" as any)
        .select("id, license_id, customer_id, amount_cents, method, note, paid_at")
        .eq("partner_id", context.userId)
        .order("paid_at", { ascending: false })
        .limit(200),
    ]);

    const lic = (licenses ?? []) as any[];
    const pay = (payments ?? []) as any[];
    return {
      customers: (customers ?? []) as any[],
      licenses: lic,
      payments: pay,
      summary: {
        customers: (customers ?? []).length,
        activeLicenses: lic.filter((l) => l.status === "active").length,
        pendingSync: lic.filter((l) => l.status === "pending_sync").length,
        revenueCents: pay.reduce((s, p) => s + (p.amount_cents ?? 0), 0),
      },
    };
  });

/** Cadastra um cliente do parceiro. */
export const partnerCreateCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        contact: z.string().trim().max(160).optional().nullable(),
        notes: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const guard = await requireResellerPartner(context);
    if (guard.error) return { error: guard.error };
    const { data: created, error } = await guard.admin
      .from("partner_customers")
      .insert({
        partner_id: context.userId,
        name: data.name,
        contact: data.contact || null,
        notes: data.notes || null,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { ok: true, customerId: created.id };
  });

/** Cria a licença do cliente e já abre a conta no painel. */
export const partnerCreateLicense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        customerId: z.string().uuid(),
        planSlug: z.enum(["login-7d", "login-30d", "login-lifetime"]).default("login-30d"),
        priceCents: z.number().int().min(0).max(10_000_00).default(0),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const guard = await requireResellerPartner(context);
    if (guard.error) return { error: guard.error };
    const admin = guard.admin;

    const { data: customer } = await admin
      .from("partner_customers")
      .select("id, name")
      .eq("id", data.customerId)
      .eq("partner_id", context.userId)
      .maybeSingle();
    if (!customer) return { error: "Cliente não encontrado na sua carteira." };

    const yaarsa = await import("@/lib/yaarsa.server");
    const panel = await yaarsa.resolveTrialPanel();
    const creds = yaarsa.generateCredentials();
    const username = yaarsa.sanitizePanelUsername(creds.username);
    const expiresAt = addDays(new Date(), PLAN_DAYS[data.planSlug] ?? 30);

    const res = await yaarsa.yaarsaCreateAccount({
      username,
      email: creds.email,
      password: creds.password,
      planSlug: data.planSlug,
      totalPaid: Math.round(data.priceCents / 100),
      additionalInfo: `revenda:${context.userId.slice(0, 8)}:${(customer as any).name}`.slice(0, 120),
      panel,
    });

    const synced = Boolean(res.Success);
    const { data: created, error } = await admin
      .from("partner_licenses")
      .insert({
        partner_id: context.userId,
        customer_id: data.customerId,
        plan_slug: data.planSlug,
        panel,
        panel_username: username,
        panel_email: creds.email,
        panel_password_enc: yaarsa.encrypt(creds.password),
        status: synced ? "active" : "pending_sync",
        expires_at: expiresAt.toISOString(),
        price_cents: data.priceCents,
        last_sync_at: synced ? new Date().toISOString() : null,
        sync_error: synced ? null : res.Fail || "O painel não confirmou a criação.",
      })
      .select("id")
      .single();
    if (error) return { error: error.message };

    return {
      ok: true,
      licenseId: created.id,
      synced,
      login: { email: creds.email, username, password: creds.password },
      warning: synced ? null : res.Fail || "Login salvo, mas o painel ainda não confirmou. Use 'Sincronizar'.",
    };
  });

/** Tenta novamente colocar a licença no painel (ou confirma que já está lá). */
export const partnerSyncLicense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ licenseId: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const guard = await requireResellerPartner(context);
    if (guard.error) return { error: guard.error };
    const admin = guard.admin;

    const { data: lic } = await admin
      .from("partner_licenses")
      .select("*")
      .eq("id", data.licenseId)
      .eq("partner_id", context.userId)
      .maybeSingle();
    if (!lic) return { error: "Licença não encontrada." };

    const yaarsa = await import("@/lib/yaarsa.server");
    const panel = ((lic as any).panel || "v457") as any;
    const password = yaarsa.decrypt((lic as any).panel_password_enc || "");
    const expireDate = (lic as any).expires_at
      ? new Date((lic as any).expires_at).toISOString().slice(0, 10)
      : null;

    // 1) A conta já existe? Então só reafirmamos senha e validade.
    const probe = await yaarsa.yaarsaProbeAccount((lic as any).panel_email, panel);
    let ok = false;
    let detail = "";

    if ((probe as any)?.exists) {
      const pw = await yaarsa.yaarsaSetPassword(
        (lic as any).panel_email,
        password,
        panel,
        (lic as any).panel_username,
        expireDate,
      );
      ok = Boolean(pw.Success);
      detail = pw.Fail || "";
      if (ok && expireDate) await yaarsa.yaarsaExtend((lic as any).panel_email, expireDate, panel);
    } else {
      const res = await yaarsa.yaarsaCreateAccount({
        username: (lic as any).panel_username || yaarsa.sanitizePanelUsername((lic as any).panel_email),
        email: (lic as any).panel_email,
        password,
        planSlug: (lic as any).plan_slug,
        totalPaid: Math.round(((lic as any).price_cents ?? 0) / 100),
        panel,
      });
      ok = Boolean(res.Success);
      detail = res.Fail || "";
      if (ok && expireDate) await yaarsa.yaarsaExtend((lic as any).panel_email, expireDate, panel);
    }

    await admin
      .from("partner_licenses")
      .update({
        status: ok ? "active" : "pending_sync",
        last_sync_at: ok ? new Date().toISOString() : (lic as any).last_sync_at,
        sync_error: ok ? null : detail || "O painel não respondeu.",
      })
      .eq("id", data.licenseId);

    return ok ? { ok: true } : { error: detail || "O painel não confirmou a sincronização." };
  });

/** Mostra o login do cliente (senha em texto) para o parceiro repassar. */
export const partnerRevealLicense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ licenseId: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const guard = await requireResellerPartner(context);
    if (guard.error) return { error: guard.error };
    const { data: lic } = await guard.admin
      .from("partner_licenses")
      .select("panel_email, panel_username, panel_password_enc")
      .eq("id", data.licenseId)
      .eq("partner_id", context.userId)
      .maybeSingle();
    if (!lic) return { error: "Licença não encontrada." };
    const { decrypt } = await import("@/lib/yaarsa.server");
    return {
      ok: true,
      login: {
        email: (lic as any).panel_email,
        username: (lic as any).panel_username,
        password: decrypt((lic as any).panel_password_enc || ""),
      },
    };
  });

/** Registra o pagamento do cliente, renova a validade e grava no histórico. */
export const partnerRegisterPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        licenseId: z.string().uuid(),
        amountCents: z.number().int().min(0).max(10_000_00),
        method: z.enum(["pix", "dinheiro", "cartao", "outro"]).default("pix"),
        note: z.string().trim().max(400).optional().nullable(),
        renew: z.boolean().default(true),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const guard = await requireResellerPartner(context);
    if (guard.error) return { error: guard.error };
    const admin = guard.admin;

    const { data: lic } = await admin
      .from("partner_licenses")
      .select("id, customer_id, plan_slug, panel, panel_email, expires_at, status")
      .eq("id", data.licenseId)
      .eq("partner_id", context.userId)
      .maybeSingle();
    if (!lic) return { error: "Licença não encontrada." };

    const { error: payErr } = await admin.from("partner_payments").insert({
      partner_id: context.userId,
      license_id: (lic as any).id,
      customer_id: (lic as any).customer_id,
      amount_cents: data.amountCents,
      method: data.method,
      note: data.note || null,
    });
    if (payErr) return { error: payErr.message };

    let newExpires: Date | null = (lic as any).expires_at ? new Date((lic as any).expires_at) : null;
    let panelWarning: string | null = null;

    if (data.renew) {
      const days = PLAN_DAYS[(lic as any).plan_slug] ?? 30;
      const base = newExpires && newExpires.getTime() > Date.now() ? newExpires : new Date();
      newExpires = addDays(base, days);
      const yaarsa = await import("@/lib/yaarsa.server");
      const res = await yaarsa.yaarsaExtend(
        (lic as any).panel_email,
        newExpires.toISOString().slice(0, 10),
        ((lic as any).panel || "v457") as any,
      );
      if (!res.Success) panelWarning = res.Fail || "O painel não confirmou a nova validade.";
    }

    const { error: upErr } = await admin
      .from("partner_licenses")
      .update({
        paid: true,
        expires_at: newExpires ? newExpires.toISOString() : null,
        status: panelWarning ? "pending_sync" : "active",
        sync_error: panelWarning,
        last_sync_at: panelWarning ? (lic as any).last_sync_at : new Date().toISOString(),
      })
      .eq("id", (lic as any).id);
    if (upErr) return { error: upErr.message };

    return { ok: true, expiresAt: newExpires?.toISOString() ?? null, warning: panelWarning };
  });

/** Cancela a licença do cliente e apaga a conta do painel. */
export const partnerCancelLicense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ licenseId: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const guard = await requireResellerPartner(context);
    if (guard.error) return { error: guard.error };
    const admin = guard.admin;

    const { data: lic } = await admin
      .from("partner_licenses")
      .select("id, panel, panel_email")
      .eq("id", data.licenseId)
      .eq("partner_id", context.userId)
      .maybeSingle();
    if (!lic) return { error: "Licença não encontrada." };

    const { yaarsaRemoveAccount } = await import("@/lib/yaarsa.server");
    const res = await yaarsaRemoveAccount((lic as any).panel_email, ((lic as any).panel || "v457") as any);

    await admin
      .from("partner_licenses")
      .update({
        status: "cancelled",
        sync_error: res.Success ? null : res.Fail || "O painel não confirmou a remoção.",
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", (lic as any).id);

    return { ok: true, warning: res.Success ? null : res.Fail || null };
  });
