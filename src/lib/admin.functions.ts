import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tierFromPlanSlug, type VersionTier } from "@/lib/plans";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

// Compute expire_date + server_paid_until aligned to next day 20 for monthly plans.
function computeExpiries(planSlug: string, customExpire?: string | null) {
  const next20 = (() => {
    const d = new Date();
    const t = new Date(d.getFullYear(), d.getMonth(), 20, 23, 59, 59);
    if (d.getDate() >= 20) t.setMonth(t.getMonth() + 1);
    return t;
  })();
  let expiresAt: Date;
  if (customExpire) expiresAt = new Date(customExpire);
  else if (planSlug === "login-7d") { expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7); }
  else if (planSlug === "login-lifetime") { expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 20); }
  else expiresAt = next20;
  return { expiresAt, serverPaidUntil: next20 };
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("profiles")
      .select("id,email,full_name,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    return data ?? [];
  });

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    if (ids.length === 0) return rows.map((r: any) => ({ ...r, profile: null }));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profs } = await supabaseAdmin.from("profiles").select("id,email,full_name").in("id", ids);
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return rows.map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });


export const adminListLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("licenses").select("*").order("created_at", { ascending: false }).limit(200);
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    if (ids.length === 0) return rows.map((r: any) => ({ ...r, profile: null }));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profs } = await supabaseAdmin.from("profiles").select("id,email,full_name").in("id", ids);
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return rows.map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });


export const adminRevokeLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ licenseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { yaarsaRemoveAccount } = await import("./yaarsa.server");
    const { data: lic } = await context.supabase.from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");
    await yaarsaRemoveAccount(lic.yaarsa_email, (lic as any).panel ?? "v457");
    await context.supabase.from("licenses").update({ revoked: true }).eq("id", data.licenseId);
    return { ok: true };
  });

export const adminExtendLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ licenseId: z.string().uuid(), newExpireDate: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { yaarsaExtend } = await import("./yaarsa.server");
    const { data: lic } = await context.supabase.from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");
    const r = await yaarsaExtend(lic.yaarsa_email, data.newExpireDate, (lic as any).panel ?? "v457");
    if (r.Fail) throw new Error(r.Fail);
    await context.supabase.from("licenses").update({ expires_at: new Date(data.newExpireDate).toISOString(), revoked: false }).eq("id", data.licenseId);
    return { ok: true };
  });

export const adminListThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    filter: z.enum(["open", "mine", "closed", "all"]).default("open"),
  }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("support_threads")
      .select("id, user_id, subject, status, created_at, updated_at, assigned_to, assigned_name, assigned_at, closed_at, closed_by_name, last_customer_message_at, last_staff_message_at, unread_by_staff, unread_by_customer");
    if (data.filter === "open") q = q.neq("status", "closed");
    else if (data.filter === "mine") q = q.eq("assigned_to", context.userId).neq("status", "closed");
    else if (data.filter === "closed") q = q.eq("status", "closed");
    const { data: threads } = await q.order("last_customer_message_at", { ascending: false }).limit(300);
    const list = threads ?? [];
    const userIds = Array.from(new Set(list.map((t: any) => t.user_id)));
    const { data: profs } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id,email,full_name").in("id", userIds)
      : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return list.map((t: any) => ({ ...t, profile: map.get(t.user_id) ?? null }));
  });

/**
 * Admin/moderador assume a conversa. Grava assigned_to + snapshot do nome,
 * insere uma mensagem de sistema visível ao cliente ("Ana do suporte
 * assumiu a conversa a partir daqui").
 */
export const adminAssumeThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ threadId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin
      .from("profiles").select("full_name,email").eq("id", context.userId).maybeSingle();
    const name = (me?.full_name?.trim() || me?.email?.split("@")[0] || "Suporte");
    await supabaseAdmin.from("support_threads").update({
      status: "assigned",
      assigned_to: context.userId,
      assigned_name: name,
      assigned_at: new Date().toISOString(),
    }).eq("id", data.threadId);
    await context.supabase.from("support_messages").insert({
      thread_id: data.threadId,
      sender_id: context.userId,
      is_admin: true,
      is_system: true,
      body: `🎧 ${name} assumiu a conversa a partir daqui.`,
    });
    return { ok: true, name };
  });

/**
 * Admin/moderador encerra a conversa. Insere mensagem de sistema e marca
 * status=closed. O cliente ainda vê o histórico e uma nova mensagem dele
 * abre uma nova thread automaticamente.
 */
export const adminCloseThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    threadId: z.string().uuid(),
    reason: z.string().trim().max(200).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin
      .from("profiles").select("full_name,email").eq("id", context.userId).maybeSingle();
    const name = (me?.full_name?.trim() || me?.email?.split("@")[0] || "Suporte");
    await supabaseAdmin.from("support_threads").update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: context.userId,
      closed_by_name: name,
    }).eq("id", data.threadId);
    await context.supabase.from("support_messages").insert({
      thread_id: data.threadId,
      sender_id: context.userId,
      is_admin: true,
      is_system: true,
      body: `✅ Atendimento encerrado por ${name}${data.reason ? ` — ${data.reason}` : ""}. Envie uma nova mensagem para abrir outro atendimento.`,
    });
    return { ok: true };
  });


export const adminListThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ threadId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: msgs } = await supabaseAdmin
      .from("support_messages").select("*")
      .eq("thread_id", data.threadId).order("created_at", { ascending: true });
    return msgs ?? [];
  });

export const adminSendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    threadId: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Use the authenticated supabase client (not supabaseAdmin) so the
    // enforce_support_msg_admin_flag trigger sees auth.uid() = admin and
    // preserves is_admin=true. When inserted via service_role, auth.uid()
    // is NULL and the trigger forces is_admin=false, making replies appear
    // as if the client sent them.
    const { data: msg, error } = await context.supabase.from("support_messages").insert({
      thread_id: data.threadId,
      sender_id: context.userId,
      is_admin: true,
      body: data.body,
    }).select("*").single();
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("support_threads").update({ updated_at: new Date().toISOString() }).eq("id", data.threadId);
    return msg;
  });


export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { count: users } = await context.supabase.from("profiles").select("*", { count: "exact", head: true });
    const { count: licenses } = await context.supabase.from("licenses").select("*", { count: "exact", head: true }).eq("revoked", false);
    const { data: paid } = await context.supabase.from("orders").select("amount").eq("status", "paid");
    const revenue = (paid ?? []).reduce((s, r) => s + Number(r.amount), 0);
    return { users: users ?? 0, licenses: licenses ?? 0, revenue };
  });

// ---- Staff management ----
export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    role: z.enum(["admin", "moderator", "user"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Wipe existing roles, then insert the new one
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("user_roles").select("user_id, role");
    return data ?? [];
  });

// ---- Client license operations ----
function nextDay20(): Date {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), 20, 23, 59, 59);
  if (d.getDate() >= 20) t.setMonth(t.getMonth() + 1);
  return t;
}

export const adminRenewClientServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ licenseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaExtend } = await import("./yaarsa.server");
    const { data: lic } = await supabaseAdmin.from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");
    const target = nextDay20();
    const ymd = target.toISOString().slice(0, 10);
    const r = await yaarsaExtend(lic.yaarsa_email, ymd, (lic as any).panel ?? "v457");
    if (r.Fail) throw new Error(`Painel: ${r.Fail}`);
    await supabaseAdmin.from("licenses").update({
      expires_at: target.toISOString(),
      server_paid_until: target.toISOString(),
      suspended_at: null, suspended_by: null, expires_at_before_suspend: null,
      revoked: false,
    }).eq("id", data.licenseId);
    return { ok: true, expires_at: target.toISOString() };
  });

export const adminRecreateLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ licenseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaCreateAccount, yaarsaRemoveAccount, generateCredentials, encrypt } = await import("./yaarsa.server");
    const { data: lic } = await supabaseAdmin.from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");
    const panel = (lic as any).panel ?? "v457";

    // Best-effort remove old yaarsa account, then create a new one on the same panel
    await yaarsaRemoveAccount(lic.yaarsa_email, panel);
    const creds = generateCredentials();
    const target = nextDay20();
    const yr = await yaarsaCreateAccount({
      username: creds.username, email: creds.email, password: creds.password,
      planSlug: lic.plan_slug, totalPaid: 0, additionalInfo: `shadow-recreate-${lic.id}`,
      panel,
    });
    if (yr.Fail) throw new Error(`Painel: ${yr.Fail}`);
    const { yaarsaExtend } = await import("./yaarsa.server");
    await yaarsaExtend(creds.email, target.toISOString().slice(0, 10), panel);

    // Trial: expira em 24h reais (o cron de expiração corta no Yaarsa quando bate).
    // Demais planos: alinha ao próximo dia 20.
    const isTrial = lic.is_trial || lic.plan_slug === "trial";
    const newExpiresAt = isTrial
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : target;
    await supabaseAdmin.from("licenses").update({
      yaarsa_username: creds.username,
      yaarsa_email: creds.email,
      yaarsa_password_enc: encrypt(creds.password),
      expires_at: newExpiresAt.toISOString(),
      server_paid_until: isTrial ? null : target.toISOString(),
      suspended_at: null, suspended_by: null, expires_at_before_suspend: null,
      disabled_at: null, revoked: false,
    }).eq("id", data.licenseId);

    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${panel}`, action: "admin_recreate_license", outcome: "success",
      context: { license_id: data.licenseId, is_trial: isTrial, new_email: creds.email } as any,
    } as any);
    return { ok: true, credentials: creds, expires_at: newExpiresAt.toISOString(), is_trial: isTrial };
  });

// Substitui o trial quebrado de um usuário: remove a conta antiga do Yaarsa,
// apaga a linha antiga em licenses/trials e gera um trial novo (24h) numa
// conta fresca. Uso: cliente reporta "não consigo usar meu trial".
export const adminReplaceUserTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaCreateAccount, yaarsaRemoveAccount, generateCredentials, encrypt } = await import("./yaarsa.server");

    const { data: oldLic } = await supabaseAdmin
      .from("licenses").select("*")
      .eq("user_id", data.userId).eq("is_trial", true).maybeSingle();

    const panel: "v457" | "v46" = (oldLic as any)?.panel ?? "v457";

    // 1) Remove conta antiga no painel (best-effort, ignora "não encontrado").
    if (oldLic) {
      const rem = await yaarsaRemoveAccount(oldLic.yaarsa_email, panel);
      if (rem.Fail && !/not.*found|inexist|1005/i.test(rem.Fail)) {
        // não bloqueia: log e segue
        await supabaseAdmin.from("integration_logs").insert({
          source: `yaarsa-${panel}`, action: "admin_replace_trial_remove", outcome: "warn",
          error: rem.Fail, context: { user_id: data.userId, email: oldLic.yaarsa_email } as any,
        } as any);
      }
      await supabaseAdmin.from("trials").delete().eq("user_id", data.userId);
      await supabaseAdmin.from("licenses").delete().eq("id", oldLic.id);
    }

    // 2) Cria trial fresco.
    const creds = generateCredentials();
    const yr = await yaarsaCreateAccount({
      username: creds.username, email: creds.email, password: creds.password,
      planSlug: "trial", totalPaid: 0, additionalInfo: `shadow-admin-retrial-${data.userId}`,
      panel,
    });
    if (yr.Fail) throw new Error(`Painel: ${yr.Fail}`);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { data: newLic, error: insErr } = await supabaseAdmin.from("licenses").insert({
      user_id: data.userId,
      plan_slug: "trial",
      yaarsa_username: creds.username,
      yaarsa_email: creds.email,
      yaarsa_password_enc: encrypt(creds.password),
      expires_at: expiresAt.toISOString(),
      is_trial: true,
      panel,
    } as any).select("*").single();
    if (insErr || !newLic) throw new Error(insErr?.message || "Falha ao gravar licença");

    await supabaseAdmin.from("trials").upsert(
      { user_id: data.userId, license_id: newLic.id } as any,
      { onConflict: "user_id" },
    );

    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${panel}`, action: "admin_replace_trial", outcome: "success",
      context: { user_id: data.userId, new_email: creds.email, expires_at: expiresAt.toISOString() } as any,
    } as any);

    return { ok: true, credentials: creds, expires_at: expiresAt.toISOString(), panel };
  });



export const adminListLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      source: z.string().optional(),
      outcome: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("integration_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.source) q = q.eq("source", data.source);
    if (data.outcome) q = q.eq("outcome", data.outcome);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ============ Emitir licença para cliente (novo ou antigo) ============
const CreateLicenseInput = z.object({
  userEmail: z.string().trim().email().max(255),
  planSlug: z.enum(["login-7d", "login-30d", "login-lifetime"]),
  panel: z.enum(["v457", "v46"]).optional(),
  isLegacy: z.boolean().optional(),
  customExpireDate: z.string().optional(),
  legacyServerFeeBrl: z.number().positive().max(10000).optional(),
  postToThreadId: z.string().uuid().optional(),
});

async function resolveOrInviteUser(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("profiles").select("id, email").eq("email", email).maybeSingle();
  if (existing) return { userId: existing.id, invited: false };
  const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
  if (error || !invited?.user) throw new Error(`Falha ao convidar ${email}: ${error?.message || "sem retorno"}`);
  return { userId: invited.user.id, invited: true };
}

export const adminCreateLicenseForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateLicenseInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaCreateAccount, yaarsaExtend, generateCredentials, encrypt, panelFromPlanSlug } = await import("./yaarsa.server");

    const { userId, invited } = await resolveOrInviteUser(data.userEmail.toLowerCase());
    const { expiresAt, serverPaidUntil } = computeExpiries(data.planSlug, data.customExpireDate);
    const creds = generateCredentials();
    const targetPanel = data.panel ?? panelFromPlanSlug(data.planSlug);

    const yr = await yaarsaCreateAccount({
      username: creds.username,
      email: creds.email,
      password: creds.password,
      planSlug: data.planSlug,
      totalPaid: 0,
      additionalInfo: `shadow-admin-${data.isLegacy ? "legacy" : "new"}-${userId.slice(0, 8)}`,
      panel: targetPanel,
    });
    if (yr.Fail) throw new Error(`Painel[${targetPanel}]: ${yr.Fail}`);
    await yaarsaExtend(creds.email, expiresAt.toISOString().slice(0, 10), targetPanel);

    const tier: VersionTier = tierFromPlanSlug(data.planSlug);
    const serverIpForPanel = targetPanel === "v46" ? "200.9.154.103" : "191.96.78.81";
    const { data: lic, error: licErr } = await supabaseAdmin.from("licenses").insert({
      user_id: userId,
      plan_slug: data.planSlug,
      yaarsa_username: creds.username,
      yaarsa_email: creds.email,
      yaarsa_password_enc: encrypt(creds.password),
      expires_at: expiresAt.toISOString(),
      server_paid_until: serverPaidUntil.toISOString(),
      is_trial: false,
      version_tier: tier,
      is_legacy: !!data.isLegacy,
      legacy_server_fee_brl: data.isLegacy ? (data.legacyServerFeeBrl ?? 250) : null,
      panel: targetPanel,
      server_ip: serverIpForPanel,
    } as any).select("*").single();
    if (licErr) throw new Error(licErr.message);

    if (data.postToThreadId) {
      const body =
        `// nova licença emitida pelo admin\n` +
        `plano: ${data.planSlug} (${tier})\n` +
        `painel: ${targetPanel === "v46" ? "Shadow 4.6" : "Shadow 4.5.7"}\n` +
        `user: ${creds.username}\n` +
        `email: ${creds.email}\n` +
        `senha: ${creds.password}\n` +
        `servidor: ${lic?.server_ip ?? serverIpForPanel}\n` +
        `expira: ${expiresAt.toLocaleString("pt-BR")}` +
        (data.isLegacy ? `\ntaxa mensal servidor: R$ ${data.legacyServerFeeBrl ?? 250} (cliente antigo)` : "");
      // Insert via authenticated client so the trigger preserves is_admin=true
      await context.supabase.from("support_messages").insert({
        thread_id: data.postToThreadId,
        sender_id: context.userId,
        is_admin: true,
        body,
      });
      await supabaseAdmin.from("support_threads").update({ updated_at: new Date().toISOString() }).eq("id", data.postToThreadId);

    }

    return {
      ok: true,
      invited,
      userId,
      credentials: { username: creds.username, email: creds.email, password: creds.password, server_ip: lic?.server_ip ?? serverIpForPanel },
      expires_at: expiresAt.toISOString(),
      version_tier: tier,
      panel: targetPanel,
    };
  });

export const adminSetLicenseTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    licenseId: z.string().uuid(),
    versionTier: z.enum(["weekly", "monthly_457", "lifetime_46"]),
    isLegacy: z.boolean().optional(),
    legacyServerFeeBrl: z.number().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { version_tier: data.versionTier };
    if (data.isLegacy !== undefined) patch.is_legacy = data.isLegacy;
    if (data.legacyServerFeeBrl !== undefined) patch.legacy_server_fee_brl = data.legacyServerFeeBrl;
    const { error } = await supabaseAdmin.from("licenses").update(patch as any).eq("id", data.licenseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ============ Registrar cliente antigo com login Yaarsa já existente ============
// Não chama Yaarsa create — apenas grava a licença no nosso banco com as
// credenciais que o admin fornece.
const RegisterLegacyInput = z.object({
  userEmail: z.string().trim().email().max(255),
  planSlug: z.enum(["login-7d", "login-30d", "login-lifetime"]),
  yaarsaUsername: z.string().trim().min(1).max(64),
  yaarsaEmail: z.string().trim().email().max(255),
  yaarsaPassword: z.string().trim().min(1).max(128),
  panel: z.enum(["v457", "v46"]).optional(),
  serverIp: z.string().trim().min(1).max(64).optional(),
  expiresAt: z.string().min(1),
  legacyServerFeeBrl: z.number().positive().max(10000).optional(),
});

export const adminRegisterLegacyLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RegisterLegacyInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaExtend, encrypt, panelFromPlanSlug } = await import("./yaarsa.server");

    const { userId, invited } = await resolveOrInviteUser(data.userEmail.toLowerCase());
    const tier: VersionTier = tierFromPlanSlug(data.planSlug);
    const expiresAt = new Date(data.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw new Error("Data de expiração inválida");
    const targetPanel = data.panel ?? panelFromPlanSlug(data.planSlug);

    // Best-effort: align Yaarsa expire_date with our record on the correct panel.
    try { await yaarsaExtend(data.yaarsaEmail, expiresAt.toISOString().slice(0, 10), targetPanel); } catch { /* ignore */ }

    const nextDay20 = (() => {
      const d = new Date();
      const t = new Date(d.getFullYear(), d.getMonth(), 20, 23, 59, 59);
      if (d.getDate() >= 20) t.setMonth(t.getMonth() + 1);
      return t;
    })();

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      plan_slug: data.planSlug,
      yaarsa_username: data.yaarsaUsername,
      yaarsa_email: data.yaarsaEmail,
      yaarsa_password_enc: encrypt(data.yaarsaPassword),
      expires_at: expiresAt.toISOString(),
      server_paid_until: nextDay20.toISOString(),
      is_trial: false,
      version_tier: tier,
      is_legacy: true,
      legacy_server_fee_brl: data.legacyServerFeeBrl ?? 250,
      panel: targetPanel,
    };
    insertPayload.server_ip = data.serverIp ?? (targetPanel === "v46" ? "200.9.154.103" : "191.96.78.81");

    const { data: lic, error } = await supabaseAdmin.from("licenses").insert(insertPayload as any).select("*").single();
    if (error) throw new Error(error.message);
    return { ok: true, invited, userId, licenseId: lic.id, version_tier: tier };
  });

// ============ Licenças perto de vencer (para o admin ver) ============
export const adminListExpiring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ days: z.number().int().min(1).max(60).optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const days = data.days ?? 5;
    const cutoff = new Date(Date.now() + days * 86400000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("licenses")
      .select("id, user_id, plan_slug, version_tier, is_legacy, expires_at, server_paid_until, server_overdue_at, revoked, disabled_at, yaarsa_username")
      .is("disabled_at", null)
      .order("expires_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const now = Date.now();
    const filtered = (rows ?? []).filter((r: any) =>
      !r.disabled_at && !r.revoked &&
      ((r.expires_at && new Date(r.expires_at).getTime() - now < days * 86400000) ||
       (r.server_paid_until && new Date(r.server_paid_until).getTime() - now < days * 86400000))
    );
    return filtered;
  });


// ============ Referrals admin ============
export const adminListReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("referrals").select("*").order("created_at", { ascending: false }).limit(500);
    const list = (rows ?? []) as any[];
    const ids = Array.from(new Set(list.flatMap((r) => [r.referrer_id, r.referred_id])));
    let emailMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id,email,pix_key").in("id", ids);
      emailMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email]));
      // attach pix_key snapshot fallback
      const pixMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.pix_key]));
      for (const r of list) {
        if (!r.pix_key && r.reward_type === "pix") r.pix_key = pixMap[r.referrer_id] ?? null;
      }
    }
    return list.map((r) => ({
      ...r,
      referrer_email: emailMap[r.referrer_id] ?? null,
      referred_email: emailMap[r.referred_id] ?? null,
    }));
  });

export const adminMarkReferralPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      referralId: z.string().uuid(),
      status: z.enum(["pending", "granted", "paid"]),
      notes: z.string().trim().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { reward_status: data.status };
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    if (data.notes) patch.notes = data.notes;
    const { error } = await supabaseAdmin.from("referrals").update(patch).eq("id", data.referralId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ============ Alertas de falhas recorrentes ============
export const adminGetAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabaseAdmin
      .from("integration_logs")
      .select("source,action,outcome,http_status,error,created_at,url")
      .gte("created_at", since)
      .neq("outcome", "success")
      .order("created_at", { ascending: false })
      .limit(500);

    const rows = logs ?? [];
    const groups = new Map<string, { source: string; action: string | null; count: number; lastError: string | null; lastAt: string; httpStatuses: number[] }>();
    for (const r of rows) {
      const key = `${r.source}::${r.action ?? "-"}`;
      const g = groups.get(key) ?? { source: r.source, action: r.action, count: 0, lastError: null, lastAt: r.created_at, httpStatuses: [] };
      g.count += 1;
      if (!g.lastError && r.error) g.lastError = String(r.error).slice(0, 240);
      if (r.http_status) g.httpStatuses.push(r.http_status);
      groups.set(key, g);
    }

    const alerts = Array.from(groups.values())
      .filter((g) => g.source === "yaarsa" || g.count >= 3)
      .map((g) => ({
        ...g,
        severity: (g.source === "yaarsa" && g.count >= 5) || g.count >= 10 ? "critical" : g.count >= 3 ? "warn" : "info",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Also flag licenças com problemas óbvios
    const { data: stuck } = await supabaseAdmin
      .from("licenses")
      .select("id,server_paid_until,server_overdue_at,revoked")
      .not("server_overdue_at", "is", null)
      .eq("revoked", false)
      .limit(20);

    return {
      generated_at: new Date().toISOString(),
      failure_groups: alerts,
      stuck_licenses: (stuck ?? []).length,
      total_failures_1h: rows.length,
    };
  });

// ============ Lookup de email nos painéis Yaarsa (todos) ============
export const adminLookupYaarsaEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ email: z.string().trim().email().max(255) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { yaarsaLookupEmailAllPanels } = await import("./yaarsa.server");
    return await yaarsaLookupEmailAllPanels(data.email.toLowerCase());
  });


// ============ "Pagou o servidor por fora" — clientes externos ============
// Fluxo: admin marca uma licença como "pago fora", o sistema estende no
// Yaarsa até o próximo dia 20 e salva `paid_externally_until`. O cron
// `verify-external-payers` reforça essa data a cada 3 dias para garantir
// que o painel não caia. Para "cancelar", basta desmarcar — na próxima
// virada do dia 20 o cron normal revoga.

function nextDay20Date(): Date {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), 20, 23, 59, 59);
  if (d.getDate() >= 20) t.setMonth(t.getMonth() + 1);
  return t;
}

export const adminMarkPaidExternally = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      licenseId: z.string().uuid(),
      untilDate: z.string().optional(), // YYYY-MM-DD; default = próximo dia 20
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaExtend } = await import("./yaarsa.server");

    const { data: lic } = await supabaseAdmin
      .from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");

    const target = data.untilDate ? new Date(`${data.untilDate}T23:59:59`) : nextDay20Date();
    if (Number.isNaN(target.getTime())) throw new Error("Data inválida");
    const ymd = target.toISOString().slice(0, 10);
    const panel = (lic.panel === "v46" ? "v46" : "v457") as "v457" | "v46";

    const r = await yaarsaExtend(lic.yaarsa_email, ymd, panel);
    if (r.Fail) throw new Error(`Painel[${panel}]: ${r.Fail}`);

    const { error: upErr } = await supabaseAdmin.from("licenses").update({
      paid_externally: true,
      paid_externally_until: ymd,
      paid_externally_marked_at: new Date().toISOString(),
      paid_externally_last_check_at: new Date().toISOString(),
      paid_externally_last_check_status: "aligned",
      expires_at: target.toISOString(),
      server_paid_until: target.toISOString(),
      revoked: false,
      server_overdue_at: null,
      suspended_at: null, suspended_by: null, expires_at_before_suspend: null,
    } as any).eq("id", data.licenseId);
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("integration_logs").insert({
      source: "external-payer", action: "mark_paid", outcome: "success",
      context: { license_id: lic.id, user_id: lic.user_id, until: ymd, panel } as any,
    });

    return { ok: true, until: ymd, panel };
  });

export const adminUnmarkPaidExternally = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ licenseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("licenses").update({
      paid_externally: false,
      paid_externally_until: null,
      paid_externally_marked_at: null,
      paid_externally_last_check_at: null,
      paid_externally_last_check_status: null,
    } as any).eq("id", data.licenseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Lista clientes que pagam por fora — com status da última verificação da IA
// e quantos dias faltam até o próximo dia 20.
export const adminListExternalPayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("licenses")
      .select("id, user_id, plan_slug, version_tier, panel, yaarsa_username, yaarsa_email, server_ip, expires_at, server_paid_until, paid_externally, paid_externally_until, paid_externally_marked_at, paid_externally_last_check_at, paid_externally_last_check_status, is_legacy, revoked, disabled_at")
      .eq("paid_externally", true)
      .order("paid_externally_until", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const ids = Array.from(new Set(list.map((r: any) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,email,full_name").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return list.map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

// Lista candidatos para marcar como "pagador externo": licenças legacy
// ativas que ainda NÃO estão marcadas como externas.
export const adminListLegacyCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("licenses")
      .select("id, user_id, plan_slug, version_tier, panel, yaarsa_username, yaarsa_email, server_ip, expires_at, server_paid_until, is_legacy, revoked, disabled_at")
      .eq("is_legacy", true)
      .eq("paid_externally", false)
      .is("disabled_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const ids = Array.from(new Set(list.map((r: any) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,email,full_name").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return list.map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });
