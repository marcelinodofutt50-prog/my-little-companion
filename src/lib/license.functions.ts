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

/**
 * PAUSAR a licença (cliente).
 * - Congela os dias: guardamos `expires_at_before_suspend` e o instante da
 *   pausa, então o tempo restante é recalculado no despause.
 * - Bloqueia o acesso de verdade: expire_date = ontem no painel E a senha é
 *   trocada por uma senha aleatória (a original continua guardada cifrada).
 */
export const suspendMyLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => {
    return z.object({ licenseId: z.string().uuid() }).parse(input);
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lic, error } = await supabase
      .from("licenses").select("*").eq("id", data.licenseId).eq("user_id", userId).maybeSingle();
    if (error) throw new Error("A conexão com o banco falhou. Verifique sua internet e tente novamente.");
    const { canPauseLicense } = await import("./license-pause-rules");
    const gate = canPauseLicense(lic as any);
    if (!gate.ok) throw new Error(gate.message);
    if (!lic) throw new Error("Licença não encontrada");


    const panel = (lic as any).panel ?? "v457";
    const { yaarsaExtend, yaarsaSetPassword, generateCredentials, decrypt } = await import("./yaarsa.server");
    const { sha256Hex } = await import("./password-safety.server");

    // 0) SEGURANÇA: só pausamos se conseguirmos recuperar a senha original AGORA.
    // Assim nunca trancamos um cliente que não conseguiríamos destravar depois.
    let original: string | null = null;
    try { original = decrypt(lic.yaarsa_password_enc); } catch { original = null; }
    if (!original || original.length < 4) {
      throw new Error("Não conseguimos validar sua senha original — fale com o suporte antes de pausar.");
    }
    const originalFp = sha256Hex(original);
    const storedFp = (lic as any).password_fingerprint as string | null;
    if (storedFp && storedFp !== originalFp) {
      throw new Error("Divergência na senha registrada desta licença — fale com o suporte.");
    }

    // 1) trava a data no painel
    const yr = await yaarsaExtend(lic.yaarsa_email, yesterdayYMD(), panel);
    if (yr.Fail) {
      console.error("[suspendMyLicense] Yaarsa Date Fail:", yr.Fail);
      // Fallback 1: Alguns painéis recusam a data de "ontem" se ela cair num range inválido.
      // Tentamos uma data fixa bem antiga (1970) para forçar o bloqueio por expiração.
      const yrRetry = await yaarsaExtend(lic.yaarsa_email, "1970-01-01", panel);
      
      if (yrRetry.Fail) {
        console.error("[suspendMyLicense] Yaarsa Date Retry Fail:", yrRetry.Fail);
        // Fallback Final: Se o painel estiver offline ou com erro de conexão persistente,
        // não podemos garantir que a licença parou de contar no servidor.
        throw new Error(`O servidor de licenças não está respondendo. Tente pausar novamente em alguns minutos.`);
      }
    }

    // 2) troca a senha por uma aleatória (bloqueio real do login).
    // A senha de pausa NUNCA é igual à original e NUNCA é gravada como senha
    // do cliente — guardamos apenas a impressão digital para poder rejeitá-la.
    let tempPassword = generateCredentials().password;
    for (let i = 0; i < 5 && sha256Hex(tempPassword) === originalFp; i++) {
      tempPassword = generateCredentials().password;
    }
    if (sha256Hex(tempPassword) === originalFp) {
      throw new Error("Falha ao gerar senha de pausa segura — tente novamente.");
    }
    const pr = await yaarsaSetPassword(lic.yaarsa_email, tempPassword, panel, lic.yaarsa_username);
    if (pr.Fail) {
      // rollback da data para não deixar o cliente sem acesso sem pausa efetiva
      console.error("[suspendMyLicense] Yaarsa Pass Fail:", pr.Fail);
      const back = lic.expires_at ? new Date(lic.expires_at).toISOString().slice(0, 10) : "2099-12-31";
      await yaarsaExtend(lic.yaarsa_email, back, panel);
      throw new Error(`Erro ao configurar trava de segurança. Tente novamente. (Detalhe: ${pr.Fail})`);
    }

    const now = new Date();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.from("licenses").update({
      suspended_at: now.toISOString(),
      suspended_by: "user",
      expires_at_before_suspend: lic.expires_at,
      password_fingerprint: originalFp,
      suspend_password_fingerprint: sha256Hex(tempPassword),
    }).eq("id", lic.id).eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${panel}`, action: "license_pause", outcome: "success",
      context: { license_id: lic.id, expires_at: lic.expires_at } as any,
    } as any);

    const msLeft = lic.expires_at ? Math.max(0, new Date(lic.expires_at).getTime() - now.getTime()) : null;
    return { ok: true, paused_at: now.toISOString(), ms_left: msLeft };
  });

/**
 * DESPAUSAR: devolve exatamente o tempo que faltava quando pausou e restaura
 * a senha original do cliente no painel.
 */
export const reactivateMyLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => {
    return z.object({ licenseId: z.string().uuid() }).parse(input);
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lic, error } = await supabase
      .from("licenses").select("*").eq("id", data.licenseId).eq("user_id", userId).maybeSingle();
    if (error) throw new Error("A conexão com o banco falhou. Verifique sua internet e tente novamente.");
    const { canResumeLicense } = await import("./license-pause-rules");
    const gate = canResumeLicense(lic as any);
    if (!gate.ok) throw new Error(gate.message);
    if (!lic || !lic.suspended_at) throw new Error("Licença não encontrada");

    const panel = (lic as any).panel ?? "v457";
    const baseline = lic.expires_at_before_suspend ?? lic.expires_at;

    // Tempo que faltava NO MOMENTO DA PAUSA — os dias parados não contam.
    // Licença vitalícia (sem baseline) volta com validade longa padrão.
    const LIFETIME_YMD = "2099-12-31";
    const msLeft = baseline
      ? Math.max(0, new Date(baseline).getTime() - new Date(lic.suspended_at).getTime())
      : null;
    if (msLeft !== null && msLeft <= 0) throw new Error("A licença já estava expirada quando foi pausada — renove o plano");

    const newExpires = msLeft !== null ? new Date(Date.now() + msLeft) : null;
    const ymd = newExpires ? newExpires.toISOString().slice(0, 10) : LIFETIME_YMD;

    const { yaarsaExtend, yaarsaSetPassword, decrypt } = await import("./yaarsa.server");
    const { sha256Hex } = await import("./password-safety.server");

    // 0) SEGURANÇA: valida a senha ANTES de mexer no painel.
    let original: string | null = null;
    try { original = decrypt(lic.yaarsa_password_enc); } catch { original = null; }
    if (!original || original.length < 4) {
      throw new Error("Não foi possível recuperar a senha original — fale com o suporte");
    }
    const fp = sha256Hex(original);
    const expectedFp = (lic as any).password_fingerprint as string | null;
    if (expectedFp && expectedFp !== fp) {
      throw new Error("A senha registrada não confere com a original desta licença — fale com o suporte.");
    }
    const pausedFp = (lic as any).suspend_password_fingerprint as string | null;
    if (pausedFp && pausedFp === fp) {
      throw new Error("Bloqueado: a senha guardada é a senha temporária da pausa — fale com o suporte.");
    }

    // 1) devolve os dias
    const yr = await yaarsaExtend(lic.yaarsa_email, ymd, panel);
    if (yr.Fail) {
      console.error("[reactivateMyLicense] Yaarsa Extend Fail:", yr.Fail);
      throw new Error(`O servidor não conseguiu processar o retorno dos dias. Tente novamente em 1 minuto.`);
    }

    // 2) restaura a senha original (a mesma entregue na compra)
    const pr = await yaarsaSetPassword(lic.yaarsa_email, original, panel, lic.yaarsa_username);
    if (pr.Fail) throw new Error(`Painel (senha): ${pr.Fail}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.from("licenses").update({
      suspended_at: null,
      suspended_by: null,
      expires_at_before_suspend: null,
      ...(newExpires ? { expires_at: newExpires.toISOString() } : {}),
      password_fingerprint: fp,
      suspend_password_fingerprint: null,
    }).eq("id", lic.id).eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${panel}`, action: "license_resume", outcome: "success",
      context: { license_id: lic.id, new_expires_at: newExpires?.toISOString() ?? null } as any,
    } as any);

    return { ok: true, expires_at: newExpires?.toISOString() ?? null };
  });

export const disableMyLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => {
    return z.object({ licenseId: z.string().uuid(), confirm: z.literal(true) }).parse(input);
  })
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
    const { yaarsaCreateAccount, deriveCredentials, encrypt, decrypt, expireDateFor, panelFromPlanSlug } = await import("./yaarsa.server");
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

    // 1.5) Antifraude: trial é por pessoa (conexão/aparelho), não por conta.
    const { evaluateTrial } = await import("./trial-guard.server");
    const guard = await evaluateTrial({ userId });
    if (!guard.allowed) {
      throw new Error(
        `${guard.reason ?? "Teste indisponível para esta conta."} Se você acha que é um engano, fale com o suporte.`,
      );
    }

    // 2) trials.user_id is PK — atomic single-shot claim per user. Two parallel
    //    tabs / retries can only claim once; the loser reads back the winner.
    //    Validamos se a coluna ip_hash existe através do log de erro PGRST204 se falhar.
    const trialPayload = { 
      user_id: userId, 
      license_id: null, 
      ip_hash: guard.ipHash, 
      user_agent: guard.userAgent 
    };
    
    async function doClaim(p: any) {
      return supabaseAdmin.from("trials").insert(p);
    }

    let { error: claimErr } = await doClaim(trialPayload);
    
    // Fallback: Se o PostgREST reclamar que a coluna ip_hash não existe (cache antigo)
    if (claimErr && (claimErr as any).code === "PGRST204") {
      console.warn("[generateTrial] ip_hash column missing in schema cache, retrying without it...");
      const { ip_hash, user_agent, ...fallback } = trialPayload;
      const retry = await doClaim(fallback);
      claimErr = retry.error;
    }

    if (claimErr && !/duplicate key|unique/i.test(claimErr.message)) {
      console.error("[generateTrial] Claim error:", claimErr);
      throw new Error("Erro ao registrar intenção de teste: " + claimErr.message);
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
      panel: panelFromPlanSlug("trial"),
    });
    
    const alreadyExists = yr.Fail && /1004|already|exist|existe/i.test(yr.Fail);
    if (yr.Fail && !alreadyExists) {
      // Yaarsa really failed: release the claim so the user can try again.
      await supabaseAdmin.from("trials").delete()
        .eq("user_id", userId).is("license_id", null);
      throw new Error(`Painel: ${yr.Fail}`);
    }

    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 1);
    const licPayload = {
      user_id: userId,
      plan_slug: "trial",
      yaarsa_username: creds.username,
      yaarsa_email: creds.email,
      yaarsa_password_enc: encrypt(creds.password),
      expires_at: expiresAt.toISOString(),
      is_trial: true,
      panel: panelFromPlanSlug("trial") || "v457", // Ensure panel is set correctly for trial
    };

    const { data: lic, error: licErr } = await supabaseAdmin.from("licenses").insert(licPayload).select("*").maybeSingle();
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
  .validator((input: any) => {
    return z.object({ code: z.string().trim().min(1).max(64), planSlug: z.string().trim().max(64).optional() }).parse(input);
  })
  .handler(async ({ data, context }) => {
    const { data: coupon } = await context.supabase
      .from("coupons").select("*").eq("code", data.code.toUpperCase()).eq("active", true).maybeSingle();
    const { evaluateCoupon } = await import("./coupon-rules");
    const verdict = evaluateCoupon(coupon as any, {
      userId: context.userId,
      planSlug: data.planSlug ?? null,
    });
    if (!verdict.ok) return { coupon: null as null };
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
  .validator((input: any) => {
    return z.object({ email: z.string().trim().email().max(255) }).parse(input);
  })
  .handler(async ({ data }) => {
    const { yaarsaLookupEmailAllPanels } = await import("./yaarsa.server");
    let r: Awaited<ReturnType<typeof yaarsaLookupEmailAllPanels>>;
    try {
      r = await yaarsaLookupEmailAllPanels(data.email.toLowerCase());
    } catch (e: any) {
      throw new Error(`LEGACY_PANEL_UNREACHABLE: ${e?.message || "painel não respondeu"}`);
    }
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
  .validator((input: any) => {
    return z.object({
      email: z.string().trim().email().max(255),
      password: z.string().min(1).max(64),
      panel: z.enum(["v457", "v46"]),
    }).parse(input);
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const email = data.email.toLowerCase();

    // 1) A licença precisa realmente existir no painel escolhido.
    const { yaarsaLookupEmail, yaarsaExtend, encrypt } = await import("./yaarsa.server");
    let lookup: Awaited<ReturnType<typeof yaarsaLookupEmail>>;
    try {
      lookup = await yaarsaLookupEmail(email, data.panel);
    } catch (e: any) {
      throw new Error(`LEGACY_PANEL_UNREACHABLE: ${e?.message || "painel não respondeu"}`);
    }
    if (!lookup.found) {
      throw new Error(
        `LEGACY_EMAIL_NOT_IN_PANEL: o email ${email} não existe no painel ${data.panel === "v46" ? "Shadow 4.6" : "Shadow 4.5.7"}`,
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2) Evita duplicidade — se o usuário já reivindicou esse email, devolve.
    const { data: existing } = await supabaseAdmin
      .from("licenses").select("id").eq("user_id", userId).eq("yaarsa_email", email).maybeSingle();
    if (existing) {
      return {
        ok: true, licenseId: existing.id, already: true,
        panel: data.panel, email,
        server_ip: await (await import("./yaarsa.server")).resolvePanelServerHost(data.panel),
        next_renewal: null as string | null, version_tier: data.panel === "v46" ? "lifetime_46" : "monthly_457",
      };
    }

    // 2b) Esse email já pertence a outra conta do dashboard? Bloqueia com motivo claro.
    const { data: claimedByOther } = await supabaseAdmin
      .from("licenses").select("id").eq("yaarsa_email", email).neq("user_id", userId).limit(1).maybeSingle();
    if (claimedByOther) {
      throw new Error(
        "LEGACY_ALREADY_CLAIMED: este login antigo já está vinculado a outra conta do dashboard",
      );
    }

    // 3) Alinha o expire_date no Yaarsa até o próximo dia 20 (ciclo de renovação legacy).
    const today = new Date();
    const next20 = new Date(today.getFullYear(), today.getMonth(), 20);
    if (today.getDate() >= 20) next20.setMonth(next20.getMonth() + 1);
    const ymd = next20.toISOString().slice(0, 10);
    let ext: Awaited<ReturnType<typeof yaarsaExtend>>;
    try {
      ext = await yaarsaExtend(email, ymd, data.panel);
    } catch (e: any) {
      throw new Error(`LEGACY_PANEL_UNREACHABLE: ${e?.message || "painel não respondeu ao renovar"}`);
    }
    if (ext.Fail) {
      const f = String(ext.Fail);
      if (/password|senha|credential|unauthor/i.test(f)) {
        throw new Error(`LEGACY_BAD_PASSWORD: ${f}`);
      }
      throw new Error(`LEGACY_PANEL_REJECTED: ${f}`);
    }


    // 4) Persiste a licença legada no dashboard do cliente.
    const usernameGuess = email.split("@")[0].slice(0, 16);
    const versionTier = data.panel === "v46" ? "lifetime_46" : "monthly_457";
    const serverIp = await (await import("./yaarsa.server")).resolvePanelServerHost(data.panel);
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
    if (insErr || !lic) {
      await supabaseAdmin.from("integration_logs").insert({
        source: `yaarsa-${data.panel}`, action: "legacy_claim", outcome: "error",
        error: insErr?.message || "insert falhou",
        context: { user_id: userId, email } as any,
      });
      throw new Error(`LEGACY_DB_ERROR: ${insErr?.message || "não foi possível registrar a licença"}`);
    }


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

/**
 * RE-SINCRONIZAÇÃO GLOBAL (Healer):
 * Verifica licenças que podem estar com divergência entre o banco local e o painel Yaarsa.
 * Se detectada expiração no painel que não condiz com o banco (ou vice-versa),
 * tenta forçar a atualização dos dados e credenciais.
 */
export const syncAllMyLicenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: licenses } = await supabase
      .from("licenses")
      .select("*")
      .eq("user_id", userId)
      .is("disabled_at", null)
      .eq("revoked", false);

    if (!licenses || licenses.length === 0) return { ok: true, synced: 0 };

    const { yaarsaExtend, yaarsaSetPassword, decrypt } = await import("./yaarsa.server");
    const results = [];

    for (const lic of licenses) {
      const panel = (lic as any).panel ?? "v457";
      const expiresAt = lic.expires_at ? new Date(lic.expires_at) : null;
      
      // Healer Logic: Se a licença não está suspensa mas o cliente reporta erro,
      // nós "re-empurramos" a data e a senha para garantir o registro no painel Yaarsa.
      if (expiresAt && !lic.suspended_at) {
        try {
          const ymd = expiresAt.toISOString().slice(0, 10);
          // 1. Garante data
          await yaarsaExtend(lic.yaarsa_email, ymd, panel);
          
          // 2. Garante senha original
          const plain = decrypt(lic.yaarsa_password_enc);
          await yaarsaSetPassword(lic.yaarsa_email, plain, panel, lic.yaarsa_username);
          
          results.push({ id: lic.id, status: "restored" });
        } catch (e) {
          console.error(`[syncAllMyLicenses] Fail for ${lic.id}:`, e);
          results.push({ id: lic.id, status: "failed" });
        }
      }
    }

    return { ok: true, synced: results.length, details: results };
  });

