/**
 * Núcleo da pausa de login (cliente, equipe e retorno automático).
 * Pausar: trava a data no painel e troca a senha por uma aleatória.
 * Despausar: devolve os dias da licença, empurra a taxa do servidor pelo
 * tempo pausado e restaura a senha original (conferida por impressão digital).
 */
import { planResume } from "./license-pause-rules";

function yesterdayYMD(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function pauseLicenseCore(
  lic: any,
  opts: { by: "user" | "staff"; pauseUntil: Date; actorId: string },
) {
  const panel = lic.panel ?? "v457";
  const { yaarsaExtend, yaarsaSetPassword, generateCredentials, decrypt } = await import("./yaarsa.server");
  const { sha256Hex } = await import("./password-safety.server");
  const { retryPanelCall } = await import("./panel-retry.server");

  // Só pausa se der para recuperar a senha original agora.
  let original: string | null = null;
  try { original = decrypt(lic.yaarsa_password_enc); } catch { original = null; }
  if (!original || original.length < 4) {
    throw new Error("Não conseguimos validar a senha original — fale com o suporte antes de pausar.");
  }
  const originalFp = sha256Hex(original);
  if (lic.password_fingerprint && lic.password_fingerprint !== originalFp) {
    throw new Error("Divergência na senha registrada desta licença — fale com o suporte.");
  }

  const yr = await retryPanelCall(() => yaarsaExtend(lic.yaarsa_email, yesterdayYMD(), panel), { label: "pause:extend" });
  if (yr.Fail) {
    const yr2 = await retryPanelCall(() => yaarsaExtend(lic.yaarsa_email, "1970-01-01", panel), { label: "pause:extend-1970" });
    if (yr2.Fail) throw new Error("O servidor de licenças não está respondendo. Tente pausar novamente em alguns minutos.");
  }

  let tempPassword = generateCredentials().password;
  for (let i = 0; i < 5 && sha256Hex(tempPassword) === originalFp; i++) tempPassword = generateCredentials().password;
  if (sha256Hex(tempPassword) === originalFp) throw new Error("Falha ao gerar senha de pausa segura — tente novamente.");

  const pr = await retryPanelCall(
    () => yaarsaSetPassword(lic.yaarsa_email, tempPassword, panel, lic.yaarsa_username),
    { label: "pause:password" },
  );
  if (pr.Fail) {
    // Devolve a data para não deixar o cliente sem acesso sem pausa efetiva.
    const back = lic.expires_at ? new Date(lic.expires_at).toISOString().slice(0, 10) : "2099-12-31";
    await yaarsaExtend(lic.yaarsa_email, back, panel);
    throw new Error(`Erro ao travar o login no painel. Tente novamente. (Detalhe: ${pr.Fail})`);
  }

  const now = new Date();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("licenses").update({
    suspended_at: now.toISOString(),
    suspended_by: opts.by,
    expires_at_before_suspend: lic.expires_at,
    server_paid_until_before_suspend: lic.server_paid_until ?? null,
    pause_until: opts.pauseUntil.toISOString(),
    last_pause_started_at: now.toISOString(),
    password_fingerprint: originalFp,
    suspend_password_fingerprint: sha256Hex(tempPassword),
  } as any).eq("id", lic.id).is("suspended_at", null);
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("integration_logs").insert({
    source: `yaarsa-${panel}`, action: "license_pause", outcome: "success",
    context: { license_id: lic.id, by: opts.by, actor: opts.actorId, pause_until: opts.pauseUntil.toISOString() } as any,
  } as any);

  return { ok: true, paused_at: now.toISOString(), pause_until: opts.pauseUntil.toISOString(), message: "Login pausado" };
}

export async function resumeLicenseCore(lic: any, opts: { by: "user" | "staff" | "auto"; actorId: string | null }) {
  if (!lic?.suspended_at) throw new Error("Esta licença não está pausada.");
  const panel = lic.panel ?? "v457";
  const plan = planResume(lic);
  if (lic.expires_at_before_suspend && plan.newExpiresAt && Date.parse(lic.expires_at_before_suspend) <= Date.parse(lic.suspended_at)) {
    throw new Error("A licença já estava expirada quando foi pausada — renove o plano.");
  }

  const { yaarsaExtend, yaarsaSetPassword, yaarsaCreateAccount, decrypt } = await import("./yaarsa.server");
  const { sha256Hex } = await import("./password-safety.server");
  const { retryPanelCall } = await import("./panel-retry.server");

  let original: string | null = null;
  try { original = decrypt(lic.yaarsa_password_enc); } catch { original = null; }
  if (!original || original.length < 4) throw new Error("Não foi possível recuperar a senha original — fale com o suporte.");
  const fp = sha256Hex(original);
  if (lic.password_fingerprint && lic.password_fingerprint !== fp) {
    throw new Error("A senha registrada não confere com a original desta licença — fale com o suporte.");
  }
  if (lic.suspend_password_fingerprint && lic.suspend_password_fingerprint === fp) {
    throw new Error("Bloqueado: a senha guardada é a senha temporária da pausa — fale com o suporte.");
  }

  let yr = await retryPanelCall(() => yaarsaExtend(lic.yaarsa_email, plan.panelYmd, panel), { label: "resume:extend" });
  if (yr.Fail && /1005|não encontrado|not found/i.test(yr.Fail)) {
    await yaarsaCreateAccount({
      username: lic.yaarsa_username, email: lic.yaarsa_email, password: original,
      planSlug: lic.plan_slug || "mensal", totalPaid: 0, panel,
    });
    yr = await retryPanelCall(() => yaarsaExtend(lic.yaarsa_email, plan.panelYmd, panel), { label: "resume:extend-after-create" });
  } else if (yr.Fail) {
    await new Promise((r) => setTimeout(r, 800));
    yr = await retryPanelCall(() => yaarsaExtend(lic.yaarsa_email, plan.panelYmd, panel), { label: "resume:extend-retry" });
  }
  if (yr.Fail) throw new Error(`O painel não confirmou o retorno dos dias. Detalhe: ${yr.Fail}`);

  // A senha original precisa voltar e ser aplicada de verdade.
  const pr = await retryPanelCall(
    () => yaarsaSetPassword(lic.yaarsa_email, original!, panel, lic.yaarsa_username),
    { label: "resume:password", attempts: 4 },
  );
  if (pr.Fail) throw new Error(`Painel (senha): ${pr.Fail}`);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const patch: Record<string, unknown> = {
    suspended_at: null,
    suspended_by: null,
    expires_at_before_suspend: null,
    server_paid_until_before_suspend: null,
    pause_until: null,
    password_fingerprint: fp,
    suspend_password_fingerprint: null,
  };
  if (plan.newExpiresAt) patch["expires_at"] = plan.newExpiresAt;
  if (plan.newServerPaidUntil) patch["server_paid_until"] = plan.newServerPaidUntil;
  const { error } = await supabaseAdmin.from("licenses").update(patch as any).eq("id", lic.id);
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("integration_logs").insert({
    source: `yaarsa-${panel}`, action: "license_resume", outcome: "success",
    context: {
      license_id: lic.id, by: opts.by, actor: opts.actorId, paused_ms: plan.pausedMs,
      new_expires_at: plan.newExpiresAt, new_server_paid_until: plan.newServerPaidUntil, panel_date: plan.panelYmd,
    } as any,
  } as any);

  return {
    ok: true,
    expires_at: plan.newExpiresAt,
    server_paid_until: plan.newServerPaidUntil,
    message: "Login reativado com sucesso",
  };
}
