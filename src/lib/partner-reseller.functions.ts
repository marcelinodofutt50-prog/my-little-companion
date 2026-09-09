import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Revenda do parceiro: cadastro de clientes, criação de licenças (sincronizadas
 * com o painel), registro de pagamentos e histórico.
 *
 * Toda escrita passa por aqui e exige um acesso "reseller" ativo.
 */

import {
  addDays,
  buildCredentialMessage,
  decideSyncAction,
  isResellerEntitlementActive,
  planPartnerRenewal,
  resolveLicenseDays,
  summarizeDesk,
} from "@/lib/partner-reseller.server";

/** Administradores têm acesso total à área do parceiro, sem precisar comprar. */
async function isAdminUser(context: any) {
  const { resolveRoles } = await import("@/lib/roles.server");
  const { isAdmin } = await resolveRoles({
    supabase: context.supabase,
    userId: context.userId,
  });
  return isAdmin;
}

async function requireResellerPartner(context: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ents } = await supabaseAdmin
    .from("partner_entitlements")
    .select("id, kind, status, expires_at")
    .eq("user_id", context.userId)
    .eq("kind", "reseller");
  const ent = (ents ?? []).find((e: any) => isResellerEntitlementActive(e));
  if (ent) return { admin: supabaseAdmin, entitlementId: (ent as any).id };
  if (await isAdminUser(context)) return { admin: supabaseAdmin, entitlementId: undefined };
  return { admin: supabaseAdmin, error: "Você precisa de um servidor de revenda ativo para usar esta área." };
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
      summary: summarizeDesk(lic, pay, (customers ?? []) as any[]),
    };
  });

/** Cadastra um cliente do parceiro. */
export const partnerCreateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        contact: z.string().trim().max(160).optional().nullable(),
        notes: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(input),
  )
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

/**
 * Emite licença(s) para um cliente e já abre as contas no painel.
 *
 * Aceita cadastrar o cliente na hora (`newCustomer`), prazo personalizado
 * (`days`) e emissão em lote (`quantity`), para o parceiro não precisar
 * repetir o formulário a cada venda.
 */
export const partnerCreateLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        customerId: z.string().uuid().optional().nullable(),
        newCustomer: z
          .object({
            name: z.string().trim().min(2).max(120),
            contact: z.string().trim().max(160).optional().nullable(),
          })
          .optional()
          .nullable(),
        planSlug: z.enum(["login-7d", "login-30d", "login-lifetime"]).default("login-30d"),
        days: z.number().int().min(1).max(3650).optional().nullable(),
        priceCents: z.number().int().min(0).max(10_000_00).default(0),
        quantity: z.number().int().min(1).max(10).default(1),
        note: z.string().trim().max(300).optional().nullable(),
      })
      .refine((v) => Boolean(v.customerId || v.newCustomer), {
        message: "Escolha um cliente ou cadastre um novo.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const guard = await requireResellerPartner(context);
    if (guard.error) return { error: guard.error };
    const admin = guard.admin;

    // 1) Cliente: existente ou criado agora, no mesmo passo.
    let customerId = data.customerId ?? null;
    let customerName = "";
    if (customerId) {
      const { data: customer } = await admin
        .from("partner_customers")
        .select("id, name")
        .eq("id", customerId)
        .eq("partner_id", context.userId)
        .maybeSingle();
      if (!customer) return { error: "Cliente não encontrado na sua carteira." };
      customerName = (customer as any).name;
    } else if (data.newCustomer) {
      const { data: created, error } = await admin
        .from("partner_customers")
        .insert({
          partner_id: context.userId,
          name: data.newCustomer.name,
          contact: data.newCustomer.contact || null,
          notes: data.note || null,
        })
        .select("id, name")
        .single();
      if (error) return { error: error.message };
      customerId = (created as any).id;
      customerName = (created as any).name;
    }
    if (!customerId) return { error: "Escolha um cliente ou cadastre um novo." };

    const yaarsa = await import("@/lib/yaarsa.server");
    const days = resolveLicenseDays(data.planSlug, data.days ?? null);
    const expiresAt = addDays(new Date(), days);

    const created: Array<{
      licenseId: string;
      synced: boolean;
      warning: string | null;
      login: { email: string; username: string; password: string };
      message: string;
    }> = [];
    const failures: string[] = [];

    for (let i = 0; i < data.quantity; i++) {
      const panel = await yaarsa.resolveTrialPanel();
      const creds = yaarsa.generateCredentials();
      const username = yaarsa.sanitizePanelUsername(creds.username);

      let res: any;
      try {
        res = await yaarsa.yaarsaCreateAccount({
          username,
          email: creds.email,
          password: creds.password,
          planSlug: data.planSlug,
          totalPaid: Math.round(data.priceCents / 100),
          additionalInfo: `revenda:${context.userId.slice(0, 8)}:${customerName}`.slice(0, 120),
          panel,
        });
      } catch (e) {
        res = { Success: false, Fail: (e as Error)?.message ?? "O painel não respondeu." };
      }

      const synced = Boolean(res?.Success);
      const { data: row, error } = await admin
        .from("partner_licenses")
        .insert({
          partner_id: context.userId,
          customer_id: customerId,
          plan_slug: data.planSlug,
          panel,
          panel_username: username,
          panel_email: creds.email,
          panel_password_enc: yaarsa.encrypt(creds.password),
          status: synced ? "active" : "pending_sync",
          expires_at: expiresAt.toISOString(),
          price_cents: data.priceCents,
          last_sync_at: synced ? new Date().toISOString() : null,
          sync_error: synced ? null : res?.Fail || "O painel não confirmou a criação.",
        })
        .select("id")
        .single();

      if (error) {
        failures.push(error.message);
        continue;
      }

      created.push({
        licenseId: (row as any).id,
        synced,
        warning: synced ? null : res?.Fail || "Login salvo, mas o painel ainda não confirmou. Use 'Sincronizar'.",
        login: { email: creds.email, username, password: creds.password },
        message: buildCredentialMessage({
          customerName,
          email: creds.email,
          username,
          password: creds.password,
          expiresAt: expiresAt.toISOString(),
        }),
      });
    }

    if (created.length === 0) {
      return { error: failures[0] ?? "Não foi possível emitir a licença agora." };
    }

    const pending = created.filter((c) => !c.synced).length;
    return {
      ok: true,
      customerId,
      customerName,
      days,
      expiresAt: expiresAt.toISOString(),
      created,
      // Compatibilidade com a primeira versão da tela.
      licenseId: created[0]!.licenseId,
      login: created[0]!.login,
      synced: pending === 0,
      warning:
        pending === 0
          ? null
          : `${pending} de ${created.length} login(s) ainda não foram confirmados no painel. Use "Sincronizar".`,
    };
  });

/** Adiciona dias na licença sem registrar pagamento (cortesia, ajuste, atraso). */
export const partnerExtendLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ licenseId: z.string().uuid(), days: z.number().int().min(1).max(3650) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const guard = await requireResellerPartner(context);
    if (guard.error) return { error: guard.error };
    const admin = guard.admin;

    const { data: lic } = await admin
      .from("partner_licenses")
      .select("id, panel, panel_email, expires_at, status, last_sync_at")
      .eq("id", data.licenseId)
      .eq("partner_id", context.userId)
      .maybeSingle();
    if (!lic) return { error: "Licença não encontrada." };
    if ((lic as any).status === "cancelled") return { error: "Esta licença foi cancelada." };

    // Nunca encurta: soma a partir da data futura, se ainda estiver válida.
    const now = new Date();
    const current = (lic as any).expires_at ? new Date((lic as any).expires_at) : null;
    const base = current && current.getTime() > now.getTime() ? current : now;
    const newExpires = addDays(base, data.days);

    const { yaarsaExtend } = await import("@/lib/yaarsa.server");
    const res = await yaarsaExtend(
      (lic as any).panel_email,
      newExpires.toISOString().slice(0, 10),
      ((lic as any).panel || "v457") as any,
    );
    const ok = Boolean(res?.Success);

    const { error } = await admin
      .from("partner_licenses")
      .update({
        expires_at: newExpires.toISOString(),
        status: ok ? "active" : "pending_sync",
        sync_error: ok ? null : res?.Fail || "O painel não confirmou a nova validade.",
        last_sync_at: ok ? new Date().toISOString() : (lic as any).last_sync_at,
      })
      .eq("id", (lic as any).id);
    if (error) return { error: error.message };

    return {
      ok: true,
      expiresAt: newExpires.toISOString(),
      warning: ok ? null : res?.Fail || "Validade salva aqui, mas o painel ainda não confirmou.",
    };
  });

/** Tenta novamente colocar a licença no painel (ou confirma que já está lá). */
export const partnerSyncLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ licenseId: z.string().uuid() }).parse(input))
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

    const action = decideSyncAction(probe.state);
    if (action === "abort") {
      await admin
        .from("partner_licenses")
        .update({ sync_error: "O painel não respondeu agora. Tente sincronizar em instantes." })
        .eq("id", data.licenseId);
      return { error: "O painel não respondeu agora. Tente sincronizar em instantes." };
    }

    if (action === "reaffirm") {
      const pw = await yaarsa.yaarsaSetPassword(
        (lic as any).panel_email,
        password,
        panel,
        (lic as any).panel_username,
        expireDate,
      );
      ok = Boolean(pw.Success);
      detail = pw.Fail || "";
      if (ok && expireDate) {
        const ext = await yaarsa.yaarsaExtend((lic as any).panel_email, expireDate, panel);
        if (!ext.Success) {
          ok = false;
          detail = ext.Fail || "O painel não confirmou a validade.";
        }
      }
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
      if (ok && expireDate) {
        const ext = await yaarsa.yaarsaExtend((lic as any).panel_email, expireDate, panel);
        if (!ext.Success) {
          ok = false;
          detail = ext.Fail || "O painel não confirmou a validade.";
        }
      }
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ licenseId: z.string().uuid() }).parse(input))
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
  .middleware([requireSupabaseAuth])
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
      newExpires = planPartnerRenewal((lic as any).plan_slug, (lic as any).expires_at ?? null);
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ licenseId: z.string().uuid() }).parse(input))
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
