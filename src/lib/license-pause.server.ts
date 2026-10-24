/** Shared pause/return flow: revoke access, then recreate with saved credentials. */
import { planResume } from "./license-pause-rules";

async function pauseContext(lic: any) {
  const api = await import("./yaarsa.server");
  const { sha256Hex } = await import("./password-safety.server");
  await api.refreshPanelOverrides();
  const panel = lic.server_ip ? api.panelForHost(lic.server_ip) : lic.panel ?? "v457";
  if (!panel) throw new Error("Não conseguimos identificar o painel deste login. Fale com o suporte.");
  let original: string;
  try { original = api.decrypt(lic.yaarsa_password_enc); }
  catch { throw new Error("Não foi possível recuperar a senha original — fale com o suporte."); }
  if (!original || original.length < 4) throw new Error("Não foi possível recuperar a senha original — fale com o suporte.");
  const fingerprint = sha256Hex(original);
  if (lic.password_fingerprint && lic.password_fingerprint !== fingerprint) {
    throw new Error("A senha registrada não confere com a original desta licença — fale com o suporte.");
  }
  if (lic.suspend_password_fingerprint === fingerprint) {
    throw new Error("A senha guardada é a senha temporária da pausa — fale com o suporte.");
  }
  const { retryPanelCall } = await import("./panel-retry.server");
  const revoke = async () => {
    const result = await retryPanelCall(() => api.yaarsaRemoveAccount(lic.yaarsa_email, panel), { label: "pause:remove" });
    const absent = /1005|not.*found|não encontrado|inexist/i.test(String(result.Fail ?? ""));
    if (!absent && (result.Fail || !api.looksLikeRemoveConfirmed(result.Success))) {
      throw new Error("O painel não confirmou a revogação do login. Tente novamente ou fale com o suporte.");
    }
  };
  const restore = async (panelYmd: string) => {
    const create = () => api.yaarsaCreateAccount({
      username: lic.yaarsa_username, email: lic.yaarsa_email, password: original,
      planSlug: lic.plan_slug || "mensal", totalPaid: 0, panel, expireDate: panelYmd,
      additionalInfo: "shadow-pause-return",
    });
    let result = await retryPanelCall(create, { label: "resume:add" });
    // An old pause or partially completed request may leave an existing account.
    // remove -> add restores subtype as well as the expiration date.
    if (/already in use and active/i.test(String(result.Fail ?? result.Success ?? ""))) {
      await revoke();
      result = await retryPanelCall(create, { label: "resume:add-after-remove" });
    }
    const confirmed = api.looksLikeAccountCreated(result.Success) || /subscription\s+updated/i.test(String(result.Success ?? ""));
    if (result.Fail || !confirmed) throw new Error("O painel não confirmou a recriação do login. A licença continua pausada; tente novamente.");
    const password = await retryPanelCall(
      () => api.yaarsaSetPassword(lic.yaarsa_email, original, panel, lic.yaarsa_username, panelYmd),
      { label: "resume:password" },
    );
    if (password.Fail || !password.Success) {
      await revoke();
      throw new Error("O painel não confirmou a senha original. O login permanece pausado; fale com o suporte.");
    }
  };
  return { panel, fingerprint, revoke, restore };
}

export async function pauseLicenseCore(lic: any, opts: { by: "user" | "staff"; pauseUntil: Date; actorId: string }) {
  if (!lic || lic.suspended_at) throw new Error("Esta licença já está pausada ou não foi encontrada.");
  const { panel, fingerprint, revoke, restore } = await pauseContext(lic);
  // Capture the freeze point before contacting the panel so no days are lost.
  const now = new Date();
  await revoke();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("licenses").update({
    suspended_at: now.toISOString(), suspended_by: opts.by,
    expires_at_before_suspend: lic.expires_at,
    server_paid_until_before_suspend: lic.server_paid_until ?? null,
    pause_until: opts.pauseUntil.toISOString(), last_pause_started_at: now.toISOString(),
    password_fingerprint: fingerprint, suspend_password_fingerprint: null,
    panel,
  } as any).eq("id", lic.id).is("suspended_at", null).select("id").maybeSingle();
  if (error) {
    // Do not leave a revoked login with no recorded pause after a failed write.
    const rollbackDate = planResume({ ...lic, suspended_at: now.toISOString() }, now).panelYmd;
    try { await restore(rollbackDate); }
    catch { throw new Error("O login foi revogado, mas a pausa não pôde ser registrada nem restaurada. Fale com o suporte para recuperar o acesso."); }
    throw new Error("Não foi possível salvar a pausa. Seu acesso foi restaurado; tente novamente.");
  }
  if (!data) throw new Error("Esta licença foi alterada durante a pausa. Atualize a página antes de tentar novamente.");
  await supabaseAdmin.from("integration_logs").insert({
    source: `yaarsa-${panel}`, action: "license_pause", outcome: "success",
    context: { license_id: lic.id, by: opts.by, actor: opts.actorId, pause_until: opts.pauseUntil.toISOString() },
  } as any);
  return { ok: true, paused_at: now.toISOString(), pause_until: opts.pauseUntil.toISOString(), message: "Login pausado" };
}

export async function resumeLicenseCore(lic: any, opts: { by: "user" | "staff" | "auto"; actorId: string | null }) {
  if (!lic?.suspended_at) throw new Error("Esta licença não está pausada.");
  const plan = planResume(lic);
  if (lic.expires_at_before_suspend && plan.newExpiresAt && Date.parse(lic.expires_at_before_suspend) <= Date.parse(lic.suspended_at)) {
    throw new Error("A licença já estava expirada quando foi pausada — renove o plano.");
  }
  const { panel, fingerprint, revoke, restore } = await pauseContext(lic);
  await restore(plan.panelYmd);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const patch: Record<string, unknown> = {
    suspended_at: null, suspended_by: null, expires_at_before_suspend: null,
    server_paid_until_before_suspend: null, pause_until: null,
    password_fingerprint: fingerprint, suspend_password_fingerprint: null, panel,
  };
  if (plan.newExpiresAt) patch["expires_at"] = plan.newExpiresAt;
  if (plan.newServerPaidUntil) patch["server_paid_until"] = plan.newServerPaidUntil;
  const { data, error } = await supabaseAdmin.from("licenses").update(patch as any)
    .eq("id", lic.id).eq("suspended_at", lic.suspended_at).select("id").maybeSingle();
  if (error) {
    await revoke();
    throw new Error("Não foi possível salvar o retorno. Os dias continuam congelados; tente novamente.");
  }
  if (!data) throw new Error("Esta licença foi alterada durante o retorno. Atualize a página.");
  await supabaseAdmin.from("integration_logs").insert({
    source: `yaarsa-${panel}`, action: "license_resume", outcome: "success",
    context: { license_id: lic.id, by: opts.by, actor: opts.actorId, paused_ms: plan.pausedMs,
      new_expires_at: plan.newExpiresAt, new_server_paid_until: plan.newServerPaidUntil, panel_date: plan.panelYmd },
  } as any);
  return { ok: true, expires_at: plan.newExpiresAt, server_paid_until: plan.newServerPaidUntil, message: "Login reativado com sucesso" };
}
