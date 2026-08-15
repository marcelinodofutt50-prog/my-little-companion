/**
 * Aplicação da política de conduta do teste grátis (somente servidor).
 *
 * Fluxo: mensagem do cliente no suporte -> detector -> se sinalizado, checamos
 * se ele possui LOGIN COMPRADO (licença paga ativa). Se possuir, nada acontece
 * (cliente pago pode falar o que quiser). Se NÃO possuir, o teste é revogado
 * automaticamente por conduta inadequada e o caso fica registrado para auditoria.
 */
import { detectTrialMisconduct } from "./trial-misconduct";

export type MisconductOutcome = {
  flagged: boolean;
  /** Só é true quando a evidência é inequívoca (permite revogação). */
  actionable?: boolean;
  confidence?: "none" | "review" | "high";
  hasPaidLicense: boolean;
  revokedLicenseIds: string[];
  reason?: string;
};

export async function enforceTrialConduct(input: {
  threadId: string | null;
  userId: string;
  message: string;
}): Promise<MisconductOutcome> {
  const detection = detectTrialMisconduct(input.message);
  if (!detection.flagged) {
    return { flagged: false, actionable: false, confidence: "none", hasPaidLicense: false, revokedLicenseIds: [] };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Indício fraco: NUNCA punimos. Apenas registramos para revisão humana,
  // evitando confundir cliente legítimo com quem burla o teste.
  if (!detection.actionable) {
    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: input.userId,
        event: "trial_misconduct_review",
        decision: "review",
        reason: detection.matched.join(","),
        system: "support-conduct",
        metadata: {
          thread_id: input.threadId,
          matched: detection.matched,
          message_excerpt: input.message.slice(0, 240),
        },
      } as any);
    } catch (e) {
      console.error("[trial-conduct] falha ao registrar revisão:", e);
    }
    return {
      flagged: true,
      actionable: false,
      confidence: detection.confidence,
      hasPaidLicense: false,
      revokedLicenseIds: [],
      reason: detection.matched.join(","),
    };
  }


  const { data: licenses, error } = await supabaseAdmin
    .from("licenses")
    .select("id, is_trial, revoked, disabled_at, expires_at, yaarsa_email, panel")
    .eq("user_id", input.userId);

  if (error) {
    console.error("[trial-conduct] falha ao ler licenças:", error);
    return { flagged: true, actionable: true, confidence: "high", hasPaidLicense: false, revokedLicenseIds: [], reason: "leitura_falhou" };
  }

  const active = (licenses ?? []).filter(
    (l: any) =>
      !l.revoked &&
      !l.disabled_at &&
      (!l.expires_at || new Date(l.expires_at).getTime() > Date.now()),
  );

  // Login comprado = licença ativa que não é trial.
  // Também protegemos quem JÁ comprou algum dia (licença paga, mesmo expirada):
  // cliente real nunca deve ser punido automaticamente.
  const hasPaidLicense =
    active.some((l: any) => l.is_trial !== true) ||
    (licenses ?? []).some((l: any) => l.is_trial !== true);
  if (hasPaidLicense) {
    return { flagged: true, actionable: true, confidence: "high", hasPaidLicense: true, revokedLicenseIds: [] };
  }


  const trials = active.filter((l: any) => l.is_trial === true);
  const revokedLicenseIds: string[] = [];

  for (const lic of trials as any[]) {
    const { error: upErr } = await supabaseAdmin
      .from("licenses")
      .update({
        revoked: true,
        disabled_at: new Date().toISOString(),
        status: "revoked",
      } as any)
      .eq("id", lic.id);

    if (upErr) {
      console.error("[trial-conduct] falha ao revogar licença", lic.id, upErr);
      continue;
    }
    revokedLicenseIds.push(lic.id);

    // Remove do painel externo (best-effort — o banco já é a fonte da verdade).
    try {
      const { yaarsaRemoveAccount } = await import("./yaarsa.server");
      if (lic.yaarsa_email) {
        await yaarsaRemoveAccount(lic.yaarsa_email, (lic.panel ?? "v457") as any);
      }
    } catch (e) {
      console.error("[trial-conduct] falha ao remover conta no painel:", e);
    }
  }

  // Registro para auditoria (nunca deve derrubar o fluxo do suporte).
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: input.userId,
      event: "trial_revoked_misconduct",
      decision: revokedLicenseIds.length > 0 ? "revoked" : "flagged",
      reason: detection.matched.join(","),
      system: "support-conduct",
      metadata: {
        thread_id: input.threadId,
        matched: detection.matched,
        message_excerpt: input.message.slice(0, 240),
        revoked: revokedLicenseIds,
      },
    } as any);
  } catch (e) {
    console.error("[trial-conduct] falha ao registrar auditoria:", e);
  }

  if (revokedLicenseIds.length > 0 && input.threadId) {
    try {
      const { postSystemSupportMessage } = await import("./support-system-message.server");
      await postSystemSupportMessage(
        input.threadId,
        "🛡️ **Política de uso do teste grátis:** o teste é exclusivo para avaliação em um aparelho próprio, " +
          "em ambiente controlado. Identificamos relato de instalação em terceiros (cliente/pena/bico) sem uma licença comprada, " +
          "por isso o acesso de teste foi revogado por conduta inadequada. Para atender terceiros, adquira uma licença na aba de planos.",
      );
    } catch (e) {
      console.error("[trial-conduct] falha ao notificar cliente:", e);
    }
  }

  return {
    flagged: true,
    actionable: true,
    confidence: "high",
    hasPaidLicense: false,
    revokedLicenseIds,
    reason: detection.matched.join(","),
  };
}
