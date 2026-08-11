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
  ipHash?: string | null
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

  // 1.5) Antifraude evaluation could go here or remain in the calling function
  // For internal calls, we assume evaluation is done or not needed (e.g., welcome gift)

  // 2) Claim trial - Garante que o registro da intenção ocorra via Admin 
  // para evitar problemas de RLS durante o provisionamento inicial.
  const { data: claim, error: claimErr } = await supabaseAdmin.from("trials").upsert({ 
    user_id: userId,
    license_id: null,
    ip_hash: ipHash || null

  }, { onConflict: 'user_id' }).select("*").maybeSingle();

  if (claimErr) {
    console.error("[internalGenerateTrial] Intent registration failed:", claimErr);
    throw new Error("Erro ao registrar intenção de teste: " + claimErr.message);
  }


  // 3) Call Yaarsa with Retry logic for stability
  let yr: any;
  let attempts = 0;
  const maxAttempts = 3; // Shadow Protocol v15.9: Increased retry limit
  
  while (attempts < maxAttempts) {
    try {
      yr = await yaarsaCreateAccount({
        username: creds.username,
        email: creds.email,
        password: creds.password,
        planSlug: "trial",
        totalPaid: 0,
        additionalInfo: "shadow-trial",
        panel: panelFromPlanSlug("trial"),
      });

      // Shadow Protocol v15.9: Enhanced success detection
      const success = !!yr.Success || (yr.Fail && /1004|already|exist|existe/i.test(yr.Fail));
      
      if (success) break;
      
      // If we got a refusal but not a desync, we retry
      console.warn(`[internalGenerateTrial] Yaarsa refusal: ${yr.Fail || "Unknown error"}. Attempt ${attempts + 1}/${maxAttempts}.`);
    } catch (err: any) {
      console.error(`[internalGenerateTrial] Yaarsa connection error on attempt ${attempts + 1}:`, err.message);
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      // Exponential backoff: 1s, 2s, 4s...
      const delay = Math.pow(2, attempts - 1) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  const alreadyExists = !!yr.Fail && /1004|already|exist|existe/i.test(yr.Fail);
  
  if (yr.Fail && !alreadyExists) {
    // Removemos a intenção de trial se falhar no Yaarsa, para permitir retry imediato.
    await supabaseAdmin.from("trials").delete().eq("user_id", userId).is("license_id", null);
    throw new Error(`Shadow Node Refusal: ${yr.Fail}`);
  }


  // AUTO-HEAL: Se o Yaarsa disse que a conta existe, mas não temos o registro 
  // na tabela 'licenses' (desync), nós prosseguimos para criar a linha no banco, 
  // garantindo que o usuário tenha acesso aos dados que já estão no Yaarsa.
  
  const expiresAt = new Date(); 
  expiresAt.setDate(expiresAt.getDate() + durationDays);
  
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
