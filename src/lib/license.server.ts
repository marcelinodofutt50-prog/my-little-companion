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

  const { yaarsaCreateAccount, deriveCredentials, encrypt, decrypt, expireDateFor, panelFromPlanSlug } = await import("./yaarsa.server");
  
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


  // 3) Call Yaarsa with Retry logic for stability
  let yr: any;
  let attempts = 0;
  const maxAttempts = 5; // Increased retry limit for production stability
  
  while (attempts < maxAttempts) {
    try {
      console.log(`[internalGenerateTrial] Attempting Yaarsa call ${attempts + 1}/${maxAttempts} for user ${userId}`);
      yr = await yaarsaCreateAccount({
        username: creds.username,
        email: creds.email,
        password: creds.password,
        planSlug: "trial",
        totalPaid: 0,
        additionalInfo: "shadow-trial-evolution",
        panel: panelFromPlanSlug("trial"),
      });

      // Yaarsa refusal handling
      if (yr.Success) {
        console.log(`[internalGenerateTrial] Yaarsa success for user ${userId}`);
        break;
      }
      
      const alreadyExists = !!yr.Fail && /1004|already|exist|existe/i.test(yr.Fail);
      if (alreadyExists) {
        console.log(`[internalGenerateTrial] Yaarsa account already exists for user ${userId}, proceeding with sync.`);
        break;
      }

      // Handle specific refusal codes
      if (yr.Fail === "YAARSA_REFUSAL") {
        console.warn(`[internalGenerateTrial] Yaarsa license server reported instability (YAARSA_REFUSAL). Retrying...`);
      } else {
        console.warn(`[internalGenerateTrial] Yaarsa refusal: ${yr.Fail}. Retrying...`);
      }
    } catch (err: any) {
      console.error(`[internalGenerateTrial] Yaarsa connection error on attempt ${attempts + 1}:`, err.message);
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      const delay = Math.pow(2, attempts - 1) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  const alreadyExists = yr?.Fail && /1004|already|exist|existe/i.test(yr.Fail);
  
  if (yr?.Fail && !alreadyExists) {
    console.error(`[internalGenerateTrial] Yaarsa final failure after ${attempts} attempts: ${yr.Fail}`);
    await supabaseAdmin.from("trials").delete().eq("user_id", userId).is("license_id", null);
    throw new Error(`Shadow Node Refusal: ${yr.Fail}. O servidor de licenças está instável ou a configuração é inválida. Contate o suporte técnico.`);
  }


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
    panel: panelFromPlanSlug("trial") || "v455",
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
