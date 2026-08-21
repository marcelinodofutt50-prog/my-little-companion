import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { trackSchemaFailure } from "./tutorials.functions";

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
    if (error) {
      if (error.code === 'PGRST108' || error.message?.includes('schema cache')) {
        await trackSchemaFailure(error, "suspendMyLicense", false, { stage: "initial_fetch" }, userId);
      }
      throw new Error("A conexão com o banco falhou. Verifique sua internet e tente novamente.");
    }
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
      // Se for apenas erro de "não encontrado", tentamos criar a conta (upsert informal)
      if (/1005|não encontrado|not found/i.test(pr.Fail)) {
        console.warn("[suspendMyLicense] Account missing during pause, attempting reconstruction...");
        const { yaarsaCreateAccount, panelFromPlanSlug } = await import("./yaarsa.server");
        await yaarsaCreateAccount({
           username: lic.yaarsa_username,
           email: lic.yaarsa_email,
           password: tempPassword,
           planSlug: (lic as any).plan_slug || "mensal",
           totalPaid: 0,
           panel: panelFromPlanSlug((lic as any).plan_slug)
        });
      } else {
        // rollback da data para não deixar o cliente sem acesso sem pausa efetiva
        console.error("[suspendMyLicense] Yaarsa Pass Fail:", pr.Fail);
        const back = lic.expires_at ? new Date(lic.expires_at).toISOString().slice(0, 10) : "2099-12-31";
        await yaarsaExtend(lic.yaarsa_email, back, panel);
        throw new Error(`Erro ao configurar trava de segurança. Tente novamente. (Detalhe: ${pr.Fail})`);
      }
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
    return { ok: true, paused_at: now.toISOString(), ms_left: msLeft, message: "Licença suspensa com sucesso" };
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
    if (error) {
      if (error.code === 'PGRST108' || error.message?.includes('schema cache')) {
        await trackSchemaFailure(error, "reactivateMyLicense", false, { stage: "initial_fetch" }, userId);
      }
      throw new Error("A conexão com o banco falhou. Verifique sua internet e tente novamente.");
    }
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
    let yr = await yaarsaExtend(lic.yaarsa_email, ymd, panel);
    
    // Healer agressivo: se falhar a extensão, tentamos ações alternativas
    if (yr.Fail) {
      console.error("[reactivateMyLicense] Yaarsa Extend Fail:", yr.Fail);
      
      // Se o erro for 1005 (não encontrado), tentamos recriar a conta com a senha original
      if (/1005|não encontrado|not found/i.test(yr.Fail)) {
        const { yaarsaCreateAccount } = await import("./yaarsa.server");
        await yaarsaCreateAccount({
          username: lic.yaarsa_username,
          email: lic.yaarsa_email,
          password: original,
          planSlug: lic.plan_slug || "mensal",
          totalPaid: 0,
          panel
        });
        // Tenta estender novamente após recriar
        yr = await yaarsaExtend(lic.yaarsa_email, ymd, panel);
      } else {
        // Tentativa de re-sincronização agressiva em caso de timeout/rede
        await new Promise(r => setTimeout(r, 800));
        yr = await yaarsaExtend(lic.yaarsa_email, ymd, panel);
      }
      
      if (yr.Fail) {
        throw new Error(`O servidor não conseguiu processar o retorno dos dias. Detalhe: ${yr.Fail}`);
      }
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

    return { ok: true, expires_at: newExpires?.toISOString() ?? null, message: "Licença reativada com sucesso" };
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
    if (error) {
      if (error.code === 'PGRST108' || error.message?.includes('schema cache')) {
        await trackSchemaFailure(error, "listMyLicenses", false, { stage: "initial_fetch" }, context.userId);
        
        // Fallback for listMyLicenses
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: adminData, error: adminError } = await supabaseAdmin
           .from("licenses").select("*").eq("user_id", context.userId).order("created_at", { ascending: false });
           
        if (!adminError) {
          await trackSchemaFailure(error, "listMyLicenses", true, { stage: "retry_success" }, context.userId);
          return (adminData ?? []).map((row) => ({
            ...row,
            password: (() => { try { return decrypt(row.yaarsa_password_enc); } catch { return "***"; } })(),
          }));
        }
      }
      throw error;
    }
    return (data ?? []).map((row) => ({
      ...row,
      password: (() => { try { return decrypt(row.yaarsa_password_enc); } catch { return "***"; } })(),
    }));
  });

export const generateTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) =>
    z
      .object({
        deviceId: z.string().trim().max(120).optional(),
        attrs: z.string().trim().max(600).optional(),
      })
      .partial()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { internalGenerateTrial } = await import("./license.server");

    // Camada 1: regras clássicas (idade da conta, compra anterior, IP).
    const { evaluateTrial, logBlock } = await import("./trial-guard.server");
    const guard = await evaluateTrial({ userId });

    if (!guard.allowed) {
      throw new Error(
        `${guard.reason ?? "Teste indisponível para esta conta."} Se você acha que é um engano, fale com o suporte.`,
      );
    }

    // Camada 2: motor multicamadas (aparelho, hardware, rede, e-mail canônico).
    const { assessAbuse } = await import("./fraud-engine.server");
    const verdict = await assessAbuse({ userId, action: "trial", device: data ?? null });
    if (!verdict.allowed) {
      await logBlock({
        userId,
        ipHash: verdict.ipHash,
        reason: `FRAUD_ENGINE:${verdict.reasons.join(",")}`.slice(0, 200),
      }).catch(() => {});
      throw new Error(verdict.message ?? "Teste indisponível para esta conta.");
    }

    // Provisionamento com resiliência: se falhar o Yaarsa, registramos o bloqueio para auditoria
    try {
      return await internalGenerateTrial(supabaseAdmin, userId, 1, guard.ipHash ?? verdict.ipHash, {
        deviceHash: verdict.deviceHash,
        attrsHash: verdict.attrsHash,
        ipPrefixHash: verdict.ipPrefixHash,
      });
    } catch (e: any) {
      const msg = e.message || "Falha técnica no provisionamento.";
      console.error("[generateTrial] Critical failure:", e);

      await logBlock({ 
        userId, 
        ipHash: guard.ipHash, 
        reason: `PROVISIONING_FAILED: ${msg.slice(0, 100)}` 
      }).catch(() => {});

      // Bloqueio antifraude/duplicidade tem mensagem própria: não mascarar de
      // instabilidade do painel, senão o cliente fica tentando pra sempre.
      if (/teste grátis|já foi utilizado|1 por pessoa|suporte se achar/i.test(msg)) {
        throw new Error(msg);
      }

      throw new Error(`O servidor de licenças está instável no momento. Tente novamente em alguns minutos ou fale com o suporte técnico. (Código: YAARSA_REFUSAL)`);
    }
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
      
      // Se a licença está pausada, forçamos o bloqueio no painel para garantir sincronia.
      if (lic.suspended_at) {
        try {
          // Bloqueio por data antiga (1970)
          const yr = await yaarsaExtend(lic.yaarsa_email, "1970-01-01", panel);
          
          // Se falhar a data e não for 1005 (not found), tentamos ontem como fallback
          if (yr.Fail && !/1005|não encontrado|not found/i.test(yr.Fail)) {
             await yaarsaExtend(lic.yaarsa_email, yesterdayYMD(), panel);
          }
          
          results.push({ id: lic.id, status: "pause_verified" });
        } catch (e) {
          results.push({ id: lic.id, status: "failed" });
        }
        continue;
      }

      // Healer Logic: Se a licença não está suspensa mas o cliente reporta erro,
      // nós "re-empurramos" a data e a senha para garantir o registro no painel Yaarsa.
      if (expiresAt) {
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



/**
 * TROCAR A SENHA DO PAINEL (cliente).
 * Aplica a nova senha no painel BTmob/Yaarsa e só grava no banco depois que o
 * painel confirmou — assim o que o cliente vê no site é sempre o que funciona
 * no login. Licença pausada não troca senha (a senha de pausa é temporária).
 */
export const changeMyLicensePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) =>
    z.object({
      licenseId: z.string().uuid(),
      newPassword: z
        .string()
        .trim()
        .min(6, "A senha precisa ter pelo menos 6 caracteres.")
        .max(32, "A senha pode ter no máximo 32 caracteres.")
        .regex(/^[A-Za-z0-9@#._-]+$/, "Use apenas letras, números e @ # . _ -"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lic } = await supabase
      .from("licenses").select("*").eq("id", data.licenseId).eq("user_id", userId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada.");
    if ((lic as any).disabled_at) throw new Error("Esta licença está desativada.");
    if ((lic as any).suspended_at) throw new Error("Despause a licença antes de trocar a senha.");

    const panel = (lic as any).panel ?? "v457";
    const { yaarsaSetPassword, encrypt } = await import("./yaarsa.server");
    const { sha256Hex } = await import("./password-safety.server");

    const pr = await yaarsaSetPassword(
      lic.yaarsa_email, data.newPassword, panel, lic.yaarsa_username, (lic as any).expires_at ?? null,
    );
    if (pr.Fail) {
      if (/1005|não encontrado|not found/i.test(pr.Fail)) {
        throw new Error("Sua conta não foi localizada no painel. Use o botão 'Reparar acesso' e tente de novo.");
      }
      throw new Error("O painel não aceitou a troca de senha agora. Tente novamente em alguns minutos.");
    }

    // O painel pode ter recriado a conta pelo fallback `add`: reempurramos a
    // data real da licença para o painel, mantendo site e BTmob sincronizados.
    if ((lic as any).expires_at) {
      try {
        const { yaarsaExtend } = await import("./yaarsa.server");
        await yaarsaExtend(lic.yaarsa_email, String((lic as any).expires_at).slice(0, 10), panel);
      } catch { /* best-effort */ }
    }

    // Confere no painel se a senha realmente ficou gravada (quando o painel
    // expõe leitura). `verified: null` = painel não permite consultar.
    let verified: boolean | null = null;
    try {
      const { yaarsaReadAccount } = await import("./yaarsa.server");
      const acc = await yaarsaReadAccount(lic.yaarsa_email, panel);
      if (acc.known && acc.password) verified = acc.password === data.newPassword;
    } catch { /* best-effort */ }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.from("licenses").update({
      yaarsa_password_enc: encrypt(data.newPassword),
      password_fingerprint: sha256Hex(data.newPassword),
    } as any).eq("id", lic.id).eq("user_id", userId);
    if (upErr) throw new Error("Senha trocada no painel, mas falhou ao salvar aqui. Fale com o suporte.");

    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${panel}`, action: "license_password_change",
      outcome: verified === false ? "warning" : "success",
      context: {
        license_id: lic.id, user_id: userId,
        panel_action: (pr as any).action ?? null, panel_verified: verified,
      } as any,
    } as any);

    if (verified === false) {
      throw new Error(
        "O painel aceitou a troca, mas a senha conferida não bateu. Tente novamente ou fale com o suporte.",
      );
    }

    return {
      ok: true,
      verified,
      message: verified
        ? "Senha atualizada e conferida no painel. Use a nova senha no BTmob."
        : "Senha atualizada no painel. Use a nova senha no BTmob.",
    };

  });


/**
 * REPARAR ACESSO (cliente).
 * Mesma rotina que o suporte usa: "sacode" o registro no painel (empurra a data
 * e volta) e reaplica a senha guardada. Resolve o caso do teste grátis que é
 * criado no banco mas não loga no BTmob por dessincronia.
 */
export const repairMyLicenseAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => z.object({ licenseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lic } = await supabase
      .from("licenses").select("*").eq("id", data.licenseId).eq("user_id", userId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada.");
    if ((lic as any).disabled_at) throw new Error("Esta licença está desativada.");
    if ((lic as any).suspended_at) throw new Error("Esta licença está pausada — despause para reparar o acesso.");

    const panel = (lic as any).panel ?? "v457";
    const {
      yaarsaExtend, yaarsaSetPassword, yaarsaCreateAccount, decrypt, panelFromPlanSlug,
    } = await import("./yaarsa.server");

    const expires = lic.expires_at ? new Date(lic.expires_at) : null;
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const targetYmd = expires ? ymd(expires) : ymd(new Date(Date.now() + 365 * 86400000));

    let plain: string | null = null;
    try { plain = decrypt(lic.yaarsa_password_enc); } catch { plain = null; }
    if (!plain) throw new Error("Não conseguimos recuperar sua senha registrada — fale com o suporte.");

    const steps: string[] = [];

    // 1) Empurra a data 1 dia e volta: força o painel a regravar o registro.
    try {
      const bumped = new Date((expires?.getTime() ?? Date.now()) + 86400000);
      await yaarsaExtend(lic.yaarsa_email, ymd(bumped), panel);
      steps.push("data-refresh");
    } catch { steps.push("data-refresh-falhou"); }

    // 2) Reaplica a senha original.
    const pr = await yaarsaSetPassword(
      lic.yaarsa_email, plain, panel, lic.yaarsa_username, (lic as any).expires_at ?? null,
    );
    if (pr.Fail && /1005|não encontrado|not found/i.test(pr.Fail)) {
      // 3) Conta sumiu do painel: recria com as mesmas credenciais.
      const cr = await yaarsaCreateAccount({
        username: lic.yaarsa_username,
        email: lic.yaarsa_email,
        password: plain,
        planSlug: (lic as any).plan_slug ?? "trial",
        totalPaid: 0,
        additionalInfo: `shadow-repair-${lic.id}`,
        panel: panelFromPlanSlug((lic as any).plan_slug) ?? panel,
      });
      if (cr.Fail && !/1004|already|exist/i.test(cr.Fail)) {
        throw new Error("O painel de licenças não respondeu. Tente novamente em alguns minutos.");
      }
      steps.push("conta-recriada");
    } else if (pr.Fail) {
      throw new Error("O painel de licenças recusou a sincronização agora. Tente novamente em instantes.");
    } else {
      steps.push("senha-reaplicada");
    }

    // 4) Restaura a data correta.
    try {
      await yaarsaExtend(lic.yaarsa_email, targetYmd, panel);
      steps.push("data-restaurada");
    } catch { steps.push("data-restaurada-falhou"); }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${panel}`, action: "license_self_repair", outcome: "success",
      context: { license_id: lic.id, user_id: userId, steps } as any,
    } as any);

    return {
      ok: true,
      steps,
      credentials: {
        username: lic.yaarsa_username,
        email: lic.yaarsa_email,
        password: plain,
        server_ip: (lic as any).server_ip ?? null,
      },
      message: "Acesso ressincronizado com o painel. Tente entrar novamente no BTmob.",
    };
  });

/**
 * "JÁ PAGUEI A TAXA DO SERVIDOR" (cliente).
 * Reprocessa a última renovação de servidor paga do cliente: empurra todas as
 * licenças ativas para o próximo dia 20 e tira o bloqueio por atraso, sem
 * depender do webhook ter chegado.
 */
export const resyncMyServerRenewal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) =>
    z.object({ licenseId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { nextDay20 } = await import("./admin-shared");

    // 1) Existe pagamento de servidor confirmado nos últimos 45 dias?
    const since = new Date(Date.now() - 45 * 86400000).toISOString();
    const { data: serverPlans } = await supabaseAdmin
      .from("plans").select("slug").eq("category", "server");
    const serverSlugs = (serverPlans ?? []).map((p: any) => p.slug);

    const { data: paidOrders } = await supabaseAdmin
      .from("orders")
      .select("id, plan_slug, status, paid_at, created_at")
      .eq("user_id", userId)
      .eq("status", "paid")
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

    const renewal = (paidOrders ?? []).find(
      (o: any) => serverSlugs.includes(o.plan_slug) || /server|servidor|renov/i.test(o.plan_slug ?? ""),
    );

    // 2) Estado atual das licenças pagas do cliente.
    const paidUntil = nextDay20();
    const { yaarsaExtend, yaarsaReadAccount } = await import("./yaarsa.server");
    const { planServerRenewal, reconcilePanelExpiry } = await import("./server-renewal");

    const licQuery = supabaseAdmin
      .from("licenses").select("*")
      .eq("user_id", userId).eq("is_trial", false).is("disabled_at", null);
    const { data: lics } = data?.licenseId
      ? await licQuery.eq("id", data.licenseId)
      : await licQuery;

    let fixed = 0;
    let alignedFromPanel = 0;
    const details: Array<Record<string, unknown>> = [];

    for (const l of (lics ?? []) as any[]) {
      if (l.suspended_at) continue;

      // O suporte pode já ter corrigido a data direto no painel. Lemos antes
      // de mexer para nunca encurtar o acesso de quem já está regularizado.
      let panelDate: string | null = null;
      try {
        const acc = await yaarsaReadAccount(l.yaarsa_email, l.panel ?? "v457");
        panelDate = acc.known ? acc.expireDate : null;
      } catch { /* best-effort */ }

      if (renewal) {
        const plan = planServerRenewal(l, paidUntil);
        const rec = reconcilePanelExpiry(plan.panelExpireDate, panelDate, plan.patch.expires_at);
        if (rec.shouldPush) {
          try { await yaarsaExtend(l.yaarsa_email, rec.effectivePanelDate, l.panel ?? "v457"); }
          catch { /* best-effort */ }
        } else {
          alignedFromPanel++;
        }
        await supabaseAdmin
          .from("licenses")
          .update({ ...plan.patch, expires_at: rec.dbExpiresAt } as any)
          .eq("id", l.id).eq("user_id", userId);
        fixed++;
        details.push({ id: l.id, panel_date: panelDate, applied: rec.effectivePanelDate, from_panel: rec.alreadyAhead });
        continue;
      }

      // Sem pagamento localizado: ainda assim reconciliamos quando o painel já
      // mostra uma data futura maior que a do site (ajuste manual do suporte).
      const panelMs = panelDate ? Date.parse(`${panelDate}T23:59:59.000Z`) : NaN;
      const dbMs = l.expires_at ? Date.parse(l.expires_at) : null;
      const panelAhead =
        Number.isFinite(panelMs) && panelMs > Date.now() && (dbMs === null || panelMs > dbMs);
      if (panelAhead) {
        const patch: Record<string, unknown> = {
          expires_at: l.expires_at === null ? null : new Date(panelMs).toISOString(),
          revoked: false,
          server_overdue_at: null,
        };
        if (!l.suspended_at) patch['status'] = "active";
        await supabaseAdmin.from("licenses").update(patch as any).eq("id", l.id).eq("user_id", userId);
        alignedFromPanel++;
        details.push({ id: l.id, panel_date: panelDate, from_panel: true });
      }
    }

    if (!renewal && alignedFromPanel === 0) {
      return {
        ok: false,
        message:
          "Não encontramos um pagamento de servidor confirmado na sua conta nos últimos 45 dias, e o painel também não mostra uma data mais recente. Se você acabou de pagar, aguarde alguns minutos ou envie o comprovante no suporte.",
      };
    }

    await supabaseAdmin.from("integration_logs").insert({
      source: "self-service",
      action: "server_renewal_resync",
      outcome: fixed || alignedFromPanel ? "success" : "warning",
      context: {
        user_id: userId, order_id: renewal?.id ?? null, licenses: fixed,
        aligned_from_panel: alignedFromPanel, paid_until: paidUntil.toISOString(), details,
      } as any,
    } as any);

    if (!renewal) {
      return {
        ok: true,
        fixed: alignedFromPanel,
        message: `Seu acesso já estava regularizado no painel — sincronizamos ${alignedFromPanel} licença${alignedFromPanel === 1 ? "" : "s"} com a data correta.`,
      };
    }

    return {
      ok: true,
      fixed,
      aligned_from_panel: alignedFromPanel,
      paid_until: paidUntil.toISOString(),
      message: fixed
        ? alignedFromPanel
          ? `Renovação conferida em ${fixed} licença${fixed === 1 ? "" : "s"} — o painel já estava com uma data maior e ela foi preservada.`
          : `Renovação aplicada em ${fixed} licença${fixed === 1 ? "" : "s"} — válida até ${paidUntil.toLocaleDateString("pt-BR")}.`
        : "Pagamento localizado, mas nenhuma licença ativa foi encontrada. Fale com o suporte.",
    };

  });

/**
 * SINCRONIZAR COM O PAINEL (cliente).
 * Lê a data de expiração real no painel Yaarsa e, se o acesso já está liberado
 * por lá (ex.: o suporte acertou a data na mão), reativa a licença aqui e
 * corrige a contagem de dias — sem nunca encurtar o acesso.
 */
export const syncMyLicensesWithPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => z.object({ licenseId: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncLicensesWithPanel } = await import("./panel-sync.server");

    const q = supabaseAdmin.from("licenses").select("*").eq("user_id", userId).is("disabled_at", null);
    const { data: lics } = data?.licenseId ? await q.eq("id", data.licenseId) : await q;

    const report = await syncLicensesWithPanel((lics ?? []) as any[], { actor: "client", userId });

    return {
      ok: true,
      ...report,
      message: report.activated
        ? `Pronto! ${report.activated} licença${report.activated === 1 ? "" : "s"} reativada${report.activated === 1 ? "" : "s"} conforme a data do painel.`
        : report.unknown && !report.unchanged
          ? "Não conseguimos ler a data no painel agora. Tente de novo em instantes ou fale com o suporte."
          : "Tudo conferido: a data do painel é a mesma que aparece aqui. Se o servidor não foi pago, use 'Renovar servidor'.",
    };
  });
