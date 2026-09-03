import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

export interface TrialResult {
  username: string;
  email: string;
  password?: string;
  server_ip?: string | null;
  expires_at: string | null;
  expire_date_yaarsa: string;
  retried: boolean;
  id?: string;
}

export async function internalGenerateTrial(
  supabaseAdmin: SupabaseClient<Database>,
  userId: string,
  durationDays: number = 1,
  ipHash?: string | null,
  fingerprint?: { deviceHash?: string | null; attrsHash?: string | null; ipPrefixHash?: string | null } | null
): Promise<TrialResult> {

  const { yaarsaCreateAccount, deriveCredentials, encrypt, decrypt, expireDateFor, resolveTrialPanel } = await import("./yaarsa.server");
  const trialPanel = await resolveTrialPanel();
  
  const creds = deriveCredentials(`shadow-trial:v2:${userId}`); // v2 to avoid conflicts with old trial logic if needed, or stick to v1

  // 1) If the trial license row already exists, return it
  const { data: existingLic } = await supabaseAdmin
    .from("licenses").select("*")
    .eq("user_id", userId).eq("is_trial", true).maybeSingle();
    
  if (existingLic) {
    const pwd = (() => { try { return decrypt(existingLic.yaarsa_password_enc); } catch { return "***"; } })();
    return {
      username: existingLic.yaarsa_username || "",
      email: existingLic.yaarsa_email || "",
      password: pwd,
      server_ip: existingLic.server_ip,
      expires_at: existingLic.expires_at,
      expire_date_yaarsa: expireDateFor("trial"),
      retried: true,
      id: existingLic.id
    };
  }

  // 2) A PK de trials é a trava atômica. INSERT (não upsert) impede duas
  // solicitações simultâneas de avançarem para o provisionamento externo.
  // O índice único por aparelho garante 1 teste por aparelho, mesmo com
  // várias contas criadas em paralelo.
  const { error: claimErr } = await supabaseAdmin.from("trials").insert({
    user_id: userId,
    license_id: null,
    ip_hash: ipHash || null,
    device_hash: fingerprint?.deviceHash || null,
    attrs_hash: fingerprint?.attrsHash || null,
    ip_prefix_hash: fingerprint?.ipPrefixHash || null,
  } as any);

  if (claimErr) {
    console.error("[internalGenerateTrial] Intent registration failed:", claimErr);
    if (claimErr.code === "23505") {
      if (/device/i.test(claimErr.message ?? "")) {
        throw new Error("Este aparelho já utilizou o teste grátis. O benefício é 1 por pessoa — fale com o suporte se achar que é um engano.");
      }
      throw new Error("Seu teste já foi utilizado ou está sendo processado. Atualize a página em instantes.");
    }
    throw new Error("Erro ao registrar intenção de teste: " + claimErr.message);
  }


  // 3) Provisionamento no painel — com failover por painel.
  // REGRA DE OURO: a licença só é gravada se o painel confirmar que a conta
  // existe de verdade. Nunca criamos licença "fantasma" quando o painel cai
  // ou quando o limite de contas da chave foi atingido.
  const { ALL_PANELS, hasPanelServer } = await import("./yaarsa.server");
  const isLimitFail = (m: string) =>
    /maximum allowed accounts reached|allowed accounts|limite.*\d+|\d+.*accounts/i.test(m);
  const isAlreadyExists = (m: string) => /1004|already|exist|existe/i.test(m);

  const candidates: string[] = [trialPanel, ...ALL_PANELS.filter((p) => p !== trialPanel && hasPanelServer(p))];

  let usedPanel: string = trialPanel;
  let provisioned = false;
  let existedBefore = false;
  let lastFail = "";
  let limitHit = false;

  outer: for (const panel of candidates) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let yr: any;
      try {
        yr = await yaarsaCreateAccount({
          username: creds.username,
          email: creds.email,
          password: creds.password,
          planSlug: "trial",
          totalPaid: 0,
          additionalInfo: "shadow-trial-evolution",
          panel: panel as any,
        });
      } catch (err: any) {
        lastFail = err?.message || "falha de rede com o painel";
        await new Promise((r) => setTimeout(r, 2 ** attempt * 800));
        continue;
      }

      if (yr?.Success) {
        usedPanel = panel;
        provisioned = true;
        break outer;
      }

      const fail = String(yr?.Fail ?? yr?.error ?? "resposta inválida do painel");
      lastFail = fail;

      if (isAlreadyExists(fail)) {
        usedPanel = panel;
        provisioned = true;
        existedBefore = true;
        break outer;
      }

      if (isLimitFail(fail)) {
        // Limite de contas da chave: não adianta repetir no mesmo painel.
        limitHit = true;
        console.warn(`[internalGenerateTrial] Painel ${panel} sem vagas (${fail}). Tentando próximo painel.`);
        continue outer;
      }

      await new Promise((r) => setTimeout(r, 2 ** attempt * 800));
    }
  }

  if (!provisioned) {
    // Libera a trava para o usuário poder tentar de novo depois.
    await supabaseAdmin.from("trials").delete().eq("user_id", userId).is("license_id", null);
    try {
      await supabaseAdmin.from("integration_logs").insert({
        action: "trial_provision_failed",
        status: "error",
        error_message: lastFail.slice(0, 500),
        payload: { user_id: userId, panels: candidates, limit_hit: limitHit } as any,
      } as any);
    } catch { /* log é best-effort */ }

    if (limitHit) {
      throw new Error(
        "Os servidores de teste estão com a cota de contas cheia neste momento. Já avisamos a equipe — tente novamente mais tarde ou fale com o suporte para liberar seu acesso."
      );
    }
    throw new Error(
      `Não conseguimos criar sua conta de teste no servidor agora (${lastFail}). Nenhuma licença foi gerada — tente novamente em alguns minutos.`
    );
  }

  const alreadyExists = existedBefore;



  // AUTO-HEAL: Se o Yaarsa disse que a conta existe, mas não temos o registro 
  // na tabela 'licenses' (desync), nós prosseguimos para criar a linha no banco, 
  // garantindo que o usuário tenha acesso aos dados que já estão no Yaarsa.
  
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + Math.max(1, durationDays) * 24);
  
  const licPayload: any = {
    user_id: userId,
    plan_slug: "trial",
    yaarsa_username: creds.username,
    yaarsa_email: creds.email,
    yaarsa_password_enc: encrypt(creds.password),
    expires_at: expiresAt.toISOString(),
    is_trial: true,
    status: 'trial',
    origin_type: 'trial',
    panel: trialPanel || "v455",
  };

  const { data: lic, error: licErr } = await supabaseAdmin.from("licenses").insert(licPayload).select("*").maybeSingle();
  if (licErr || !lic) {
    // Se falhar a inserção da licença (ex: unique constraint no email), 
    // precisamos limpar a intenção para não bloquear o usuário.
    await supabaseAdmin.from("trials").delete().eq("user_id", userId).is("license_id", null);
    throw new Error(licErr?.message || "Falha ao gravar licença");
  }

  // Vincula o trial à licença criada
  await supabaseAdmin.from("trials").update({ license_id: lic.id }).eq("user_id", userId);


  return {
    username: creds.username,
    email: creds.email,
    password: creds.password,
    server_ip: lic.server_ip,
    expires_at: lic.expires_at,
    expire_date_yaarsa: expireDateFor("trial"),
    retried: alreadyExists ?? false,
    id: lic.id
  };
}
