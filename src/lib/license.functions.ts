import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Yaarsa expire_date format: YYYY-MM-DD. To block a login immediately we set
// expire_date to yesterday; the PHP checker treats past dates as expired.
function yesterdayYMD(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Trusted writes on `licenses` and `trials` go through supabaseAdmin.
// Identity is already validated by requireSupabaseAuth, and every write below
// scopes with an explicit `.eq("user_id", userId)` filter, so admin bypass
// never lets one user touch another user's rows.

export const suspendMyLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ licenseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lic, error } = await supabase
      .from("licenses").select("*").eq("id", data.licenseId).eq("user_id", userId).maybeSingle();
    if (error || !lic) throw new Error("Licença não encontrada");
    if (lic.disabled_at) throw new Error("Licença já foi desativada");
    if (lic.suspended_at) throw new Error("Licença já está suspensa");

    const { yaarsaExtend } = await import("./yaarsa.server");
    const yr = await yaarsaExtend(lic.yaarsa_email, yesterdayYMD(), (lic as any).panel ?? "v457");
    if (yr.Fail) throw new Error(`Painel: ${yr.Fail}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.from("licenses").update({
      suspended_at: new Date().toISOString(),
      suspended_by: "user",
      expires_at_before_suspend: lic.expires_at,
    }).eq("id", lic.id).eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

export const reactivateMyLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ licenseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lic, error } = await supabase
      .from("licenses").select("*").eq("id", data.licenseId).eq("user_id", userId).maybeSingle();
    if (error || !lic) throw new Error("Licença não encontrada");
    if (lic.disabled_at) throw new Error("Licença desativada não pode ser reativada");
    if (!lic.suspended_at) throw new Error("Licença não está suspensa");

    const restore = lic.expires_at_before_suspend ?? lic.expires_at;
    if (!restore) throw new Error("Sem data de expiração para restaurar");
    const ymd = new Date(restore).toISOString().slice(0, 10);
    if (new Date(restore) < new Date()) throw new Error("Licença expirada — renove o plano");

    const { yaarsaExtend } = await import("./yaarsa.server");
    const yr = await yaarsaExtend(lic.yaarsa_email, ymd, (lic as any).panel ?? "v457");
    if (yr.Fail) throw new Error(`Painel: ${yr.Fail}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.from("licenses").update({
      suspended_at: null,
      suspended_by: null,
      expires_at_before_suspend: null,
    }).eq("id", lic.id).eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

export const disableMyLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ licenseId: z.string().uuid(), confirm: z.literal(true) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lic, error } = await supabase
      .from("licenses").select("*").eq("id", data.licenseId).eq("user_id", userId).maybeSingle();
    if (error || !lic) throw new Error("Licença não encontrada");
    if (lic.disabled_at) return { ok: true, already: true };

    const { yaarsaRemoveAccount } = await import("./yaarsa.server");
    const yr = await yaarsaRemoveAccount(lic.yaarsa_email, (lic as any).panel ?? "v457");
    if (yr.Fail && !/not.*found|inexist/i.test(yr.Fail)) {
      throw new Error(`Painel: ${yr.Fail}`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.from("licenses").update({
      disabled_at: new Date().toISOString(),
      revoked: true,
      suspended_at: null,
      suspended_by: null,
    }).eq("id", lic.id).eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

export const listMyLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { decrypt } = await import("./yaarsa.server");
    const { data, error } = await context.supabase
      .from("licenses").select("*").eq("user_id", context.userId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      ...row,
      password: (() => { try { return decrypt(row.yaarsa_password_enc); } catch { return "***"; } })(),
    }));
  });

export const generateTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { yaarsaCreateAccount, deriveCredentials, encrypt, decrypt, expireDateFor } = await import("./yaarsa.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Deterministic credentials seeded purely by userId. The seed lives
    // server-side (auth.users), so clearing localStorage or switching device
    // NEVER produces a different Yaarsa account for the same user.
    const creds = deriveCredentials(`shadow-trial:v1:${userId}`);

    // 1) If the trial license row already exists, return it (true idempotency).
    const { data: existingLic } = await supabase
      .from("licenses").select("*")
      .eq("user_id", userId).eq("is_trial", true).maybeSingle();
    if (existingLic) {
      const pwd = (() => { try { return decrypt(existingLic.yaarsa_password_enc); } catch { return "***"; } })();
      return {
        username: existingLic.yaarsa_username,
        email: existingLic.yaarsa_email,
        password: pwd,
        server_ip: existingLic.server_ip,
        expires_at: existingLic.expires_at,
        expire_date_yaarsa: expireDateFor("trial"),
        retried: true,
      };
    }

    // 2) trials.user_id is PK — atomic single-shot claim per user. Two parallel
    //    tabs / retries can only claim once; the loser reads back the winner.
    const { error: claimErr } = await supabaseAdmin
      .from("trials").insert({ user_id: userId, license_id: null });
    if (claimErr && !/duplicate key|unique/i.test(claimErr.message)) {
      throw new Error(claimErr.message);
    }
    // 3) Call Yaarsa. Deterministic creds mean "1004 already exists" on retry
    //    is a previous successful create — treat as success.
    const yr = await yaarsaCreateAccount({
      username: creds.username,
      email: creds.email,
      password: creds.password,
      planSlug: "trial",
      totalPaid: 0,
      additionalInfo: "shadow-trial",
    });
    const alreadyExists = yr.Fail && /1004|already|exist|existe/i.test(yr.Fail);
    if (yr.Fail && !alreadyExists) {
      // Yaarsa really failed: release the claim so the user can try again.
      // Only delete rows that haven't been linked to a license yet.
      await supabaseAdmin.from("trials").delete()
        .eq("user_id", userId).is("license_id", null);
      throw new Error(`Painel: ${yr.Fail}`);
    }

    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 1);
    const { data: lic, error: licErr } = await supabaseAdmin.from("licenses").insert({
      user_id: userId,
      plan_slug: "trial",
      yaarsa_username: creds.username,
      yaarsa_email: creds.email,
      yaarsa_password_enc: encrypt(creds.password),
      expires_at: expiresAt.toISOString(),
      is_trial: true,
    }).select("*").single();
    if (licErr || !lic) {
      // Leave the claim in place; the Yaarsa account is safe and the next
      // retry will short-circuit via step (1) once the row does land.
      throw new Error(licErr?.message || "Falha ao gravar licença");
    }

    await supabaseAdmin.from("trials").update({ license_id: lic.id }).eq("user_id", userId);

    return {
      username: creds.username,
      email: creds.email,
      password: creds.password,
      server_ip: lic.server_ip,
      expires_at: lic.expires_at,
      expire_date_yaarsa: expireDateFor("trial"),
      retried: alreadyExists ?? false,
    };
  });

export const getMyCashbackBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("cashback_ledger").select("amount").eq("user_id", context.userId);
    return { balance: (data ?? []).reduce((s, r) => s + Number(r.amount), 0) };
  });

export const validateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().trim().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: coupon } = await context.supabase
      .from("coupons").select("*").eq("code", data.code.toUpperCase()).eq("active", true).maybeSingle();
    if (!coupon) return { coupon: null as null };
    return { coupon };
  });

// Whether the current user has ever been marked as a legacy client.
// Drives visibility of the R$ 250 server-renewal card on /planos.
export const getMyLegacyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("licenses").select("id").eq("user_id", context.userId).eq("is_legacy", true).limit(1);
    if (error) throw new Error(error.message);
    return { isLegacy: (data ?? []).length > 0 };
  });


// ============ Checagem pública "cliente antigo?" ============
// Retorna somente qual painel contém o email (ou null). Sem PII, sem senha.
// Autenticado para evitar enumeração de emails por bots anônimos.
export const checkLegacyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ email: z.string().trim().email().max(255) }).parse(input))
  .handler(async ({ data }) => {
    const { yaarsaLookupEmailAllPanels } = await import("./yaarsa.server");
    const r = await yaarsaLookupEmailAllPanels(data.email.toLowerCase());
    const foundIn = (r.details ?? []).filter((d) => d.found).map((d) => d.panel);
    return {
      found: r.found,
      panels: foundIn,
      suggested_tier: foundIn.includes("v46") ? "lifetime_46" : foundIn.includes("v457") ? "monthly_457" : null,
    };
  });

// ============ Reivindicação da licença por cliente antigo ============
// Cliente informa email + senha + painel confirmado. Verificamos que o email
// existe no painel escolhido, criamos a linha em `licenses` (is_legacy=true,
// taxa R$250/mês) e realinhamos o expire_date no Yaarsa para o próximo dia 20.
export const claimLegacyLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().trim().email().max(255),
      password: z.string().min(1).max(64),
      panel: z.enum(["v457", "v46"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const email = data.email.toLowerCase();

    // 1) A licença precisa realmente existir no painel escolhido.
    const { yaarsaLookupEmail, yaarsaExtend, encrypt } = await import("./yaarsa.server");
    const lookup = await yaarsaLookupEmail(email, data.panel);
    if (!lookup.found) {
      throw new Error(`Email não encontrado no painel ${data.panel === "v46" ? "Shadow 4.6" : "Shadow 4.5.7"}`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2) Evita duplicidade — se o usuário já reivindicou esse email, devolve.
    const { data: existing } = await supabaseAdmin
      .from("licenses").select("id").eq("user_id", userId).eq("yaarsa_email", email).maybeSingle();
    if (existing) {
      return {
        ok: true, licenseId: existing.id, already: true,
        panel: data.panel, email, server_ip: data.panel === "v46" ? "200.9.154.103" : "191.96.78.81",
        next_renewal: null as string | null, version_tier: data.panel === "v46" ? "lifetime_46" : "monthly_457",
      };
    }

    // 3) Alinha o expire_date no Yaarsa até o próximo dia 20 (ciclo de renovação legacy).
    const today = new Date();
    const next20 = new Date(today.getFullYear(), today.getMonth(), 20);
    if (today.getDate() >= 20) next20.setMonth(next20.getMonth() + 1);
    const ymd = next20.toISOString().slice(0, 10);
    const ext = await yaarsaExtend(email, ymd, data.panel);
    if (ext.Fail) throw new Error(`Painel: ${ext.Fail}`);

    // 4) Persiste a licença legada no dashboard do cliente.
    const usernameGuess = email.split("@")[0].slice(0, 16);
    const versionTier = data.panel === "v46" ? "lifetime_46" : "monthly_457";
    const serverIp = data.panel === "v46" ? "200.9.154.103" : "191.96.78.81";
    const planSlug = data.panel === "v46" ? "login-lifetime" : "login-30d";

    const { data: lic, error: insErr } = await supabaseAdmin.from("licenses").insert({
      user_id: userId,
      plan_slug: planSlug,
      yaarsa_username: usernameGuess,
      yaarsa_email: email,
      yaarsa_password_enc: encrypt(data.password),
      server_ip: serverIp,
      expires_at: next20.toISOString(),
      server_paid_until: ymd,
      is_trial: false,
      is_legacy: true,
      legacy_server_fee_brl: 250,
      version_tier: versionTier,
      panel: data.panel,
    } as any).select("id").single();
    if (insErr || !lic) throw new Error(insErr?.message || "Falha ao registrar licença");

    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${data.panel}`, action: "legacy_claim", outcome: "success",
      context: { user_id: userId, email, license_id: lic.id } as any,
    });

    return {
      ok: true, licenseId: lic.id, already: false,
      panel: data.panel, email, server_ip: serverIp,
      next_renewal: ymd, version_tier: versionTier,
    };
  });
