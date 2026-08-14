/**
 * Antifraude do teste grátis (somente servidor).
 * Regra: o trial é por PESSOA, não por conta. Se a mesma conexão/aparelho já
 * usou um teste com outro usuário, bloqueia — a menos que o admin tenha
 * liberado essa conexão na allowlist.
 */
import { clientIp, clientUserAgent, hashIp, isAllowlisted, maskEmail } from "./antifraud.server";

export type TrialGuard = {
  allowed: boolean;
  reason?: string;
  ipHash: string | null;
  userAgent: string | null;
};

export async function logBlock(input: {
  userId: string;
  ipHash: string | null;
  email?: string | null;
  reason: string;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("trial_blocks").insert({
      user_id: input.userId,
      ip_hash: input.ipHash,
      email_masked: maskEmail(input.email ?? undefined),
      reason: input.reason,
    });
  } catch (e) {
    console.error("[trial-guard] Failed to log block:", e);
  }
}


export async function evaluateTrial(input: {
  userId: string;
  email?: string | null;
}): Promise<TrialGuard> {
  const ip = clientIp();
  const userAgent = clientUserAgent();
  let ipHash: string | null = null;

  try {
    if (ip) ipHash = await hashIp(ip);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Conta antiga que nunca comprou não pode "descobrir" um trial novo:
    //    o teste é só para contas novas (primeiras 72h de vida).
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("created_at, email")
      .eq("id", input.userId)
      .maybeSingle();
    if (profileError || !profile?.created_at) {
      throw new Error("Não foi possível validar a criação da conta.");
    }

    const accountAgeMs = Date.now() - new Date(profile.created_at).getTime();
    if (!Number.isFinite(accountAgeMs) || accountAgeMs > 72 * 60 * 60 * 1000) {
      const reason = "O teste é exclusivo para contas criadas nas últimas 72 horas.";
      await logBlock({ userId: input.userId, ipHash, email: profile.email, reason });
      return { allowed: false, reason, ipHash, userAgent };
    }

    const { data: previousTrial, error: previousTrialError } = await supabaseAdmin
      .from("trials")
      .select("user_id")
      .eq("user_id", input.userId)
      .maybeSingle();
    if (previousTrialError) throw previousTrialError;
    if (previousTrial) {
      const reason = "Esta conta já utilizou o teste grátis.";
      await logBlock({ userId: input.userId, ipHash, email: profile.email, reason });
      return { allowed: false, reason, ipHash, userAgent };
    }

    // 2) Já comprou alguma vez? Então não é "novo usuário" — sem teste.
    const { count: paidOrders, error: paidOrdersError } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", input.userId)
      .eq("status", "paid");
    if (paidOrdersError) throw paidOrdersError;
    if ((paidOrders ?? 0) > 0) {
      const reason = "Conta já possui compras — o teste é apenas para novos usuários.";
      await logBlock({ userId: input.userId, ipHash, email: profile?.email, reason });
      return { allowed: false, reason, ipHash, userAgent };
    }

    if (!ipHash) {
      return {
        allowed: false,
        reason: "Não foi possível validar sua conexão. Desative VPN/proxy e tente novamente.",
        ipHash,
        userAgent,
      };
    }

    if (await isAllowlisted(ipHash)) return { allowed: true, ipHash, userAgent };

    // 3) Mesma conexão já pegou um teste com outra conta.
    const { data: sameIpTrials, error: sameIpTrialsError } = await supabaseAdmin
      .from("trials")
      .select("user_id")
      .eq("ip_hash", ipHash)
      .neq("user_id", input.userId)
      .limit(1);
    if (sameIpTrialsError) throw sameIpTrialsError;
    if (sameIpTrials && sameIpTrials.length > 0) {
      const reason = "Já existe um teste grátis usado nesta conexão/aparelho.";
      await logBlock({ userId: input.userId, ipHash, email: profile?.email, reason });
      return { allowed: false, reason, ipHash, userAgent };
    }

    // 4) Conta criada a partir de uma conexão que já registrou outras contas
    //    e que também já usou teste: multi-conta clássica.
    const { data: ipAccounts, error: ipAccountsError } = await supabaseAdmin
      .from("signup_ip_log")
      .select("user_id")
      .eq("ip_hash", ipHash)
      .not("user_id", "is", null);
    if (ipAccountsError) throw ipAccountsError;
    const otherUsers = Array.from(
      new Set((ipAccounts ?? []).map((r) => r.user_id as string).filter((id) => id && id !== input.userId)),
    );
    if (otherUsers.length > 0) {
      const { data: theirTrials, error: theirTrialsError } = await supabaseAdmin
        .from("trials")
        .select("user_id")
        .in("user_id", otherUsers)
        .limit(1);
      if (theirTrialsError) throw theirTrialsError;
      if (theirTrials && theirTrials.length > 0) {
        const reason = "Outra conta desta mesma conexão já utilizou o teste grátis.";
        await logBlock({ userId: input.userId, ipHash, email: profile?.email, reason });
        return { allowed: false, reason, ipHash, userAgent };
      }
    }

    return { allowed: true, ipHash, userAgent };
  } catch (err: any) {
    console.error("[trial-guard] Critical error in evaluateTrial:", err);
    return {
      allowed: false,
      reason: "A validação antifraude está temporariamente indisponível. Tente novamente em alguns minutos.",
      ipHash,
      userAgent,
    };
  }

}
