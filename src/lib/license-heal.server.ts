/**
 * CORREÇÃO DE LOGIN (BTmob/Yaarsa).
 *
 * Problema real: o cliente gera o trial (ou compra) e o BTmob responde
 * "e-mail ou senha inválidos". Isso acontece quando a conta nunca chegou a
 * existir no painel, ou quando existe lá com uma senha diferente da que o site
 * mostra.
 *
 * Estratégia (a mesma que o suporte fazia na mão):
 *   1. Tentamos CRIAR a conta no painel com exatamente as credenciais que o
 *      site mostra. O painel é a fonte da verdade: se ele aceitar, a conta não
 *      existia e agora passa a existir — problema resolvido.
 *   2. Se o painel responder "e-mail já em uso" (1004), a conta existe mas está
 *      inconsistente. Nesse caso APAGAMOS a conta no painel e a recriamos com
 *      EXATAMENTE o mesmo e-mail, usuário e senha que já estão na licença — o
 *      cliente continua com o mesmo login, só que desbugado. Só emitimos
 *      credenciais novas quando a licença não tem nenhuma senha guardada.
 *   3. Ajustamos a data de expiração para a validade real da licença.
 */

import { panelExpireDateFor } from "./panel-integrity.server";
import { updateLicenseTolerant } from "./license-password.server";

export type HealAction = "created" | "recreated" | "already_ok";

export type HealResult = {
  ok: true;
  action: HealAction;
  panel: string;
  credentials: { username: string; email: string; password: string; server_ip?: string | null };
  message: string;
  steps: string[];
  warning?: string;
};

export type HealLicense = {
  id: string;
  user_id?: string | null;
  plan_slug: string | null;
  yaarsa_username: string | null;
  yaarsa_email: string | null;
  yaarsa_password_enc: string | null;
  panel: string | null;
  expires_at: string | null;
  is_trial?: boolean | null;
  server_ip?: string | null;
};

const EXISTS_RE = /1004|already|in use|em uso|exist/i;
const QUOTA_RE = /maximum allowed accounts|quota|limit reached|limite/i;
const NOT_FOUND_RE = /1005|not\s*found|cant.?find|não\s*encontrad/i;

/** Espera entre consultas ao painel (desligada nos testes automáticos). */
function pause(ms: number) {
  return process.env.VITEST ? Promise.resolve() : new Promise((r) => setTimeout(r, ms));
}

function normalizePanel(p: string | null | undefined): "v455" | "v457" | "v46" {
  return p === "v46" ? "v46" : p === "v455" ? "v455" : "v457";
}

/**
 * Repara o login de UMA licença. Nunca deixa o cliente sem credenciais
 * funcionais: ou a conta antiga passa a existir, ou uma nova é emitida.
 *
 * A correção é EXCLUSIVA por licença: dois cliques (cliente + suporte, ou duas
 * abas) não podem apagar/recriar a mesma conta ao mesmo tempo — era assim que
 * o cliente terminava sem conta nenhuma no painel.
 */
export async function healLicenseLogin(
  lic: HealLicense,
  opts?: { reason?: string; forceRecreate?: boolean },
): Promise<HealResult> {
  const lockIdentity = (lic.yaarsa_email ?? lic.id).trim().toLowerCase();
  const lockKey = `license-account:${lockIdentity}`;
  let locked = false;
  try {
    const { acquireOpLock } = await import("./audit-trail.server");
    locked = await acquireOpLock(lockKey, 120, `${opts?.reason ?? "heal"}:${lic.id}`);
    if (!locked) {
      throw new Error(
        "Já existe uma correção em andamento para esta licença. Aguarde alguns segundos e confira o login antes de tentar de novo.",
      );
    }
  } catch (e: any) {
    // Sem trava distribuída, falhamos de forma segura: duas licenças podem
    // apontar para o mesmo e-mail remoto e não podem apagar/recriar em paralelo.
    throw e;
  }

  try {
    return await runHeal(lic, opts);
  } finally {
    if (locked) {
      const { releaseOpLock } = await import("./audit-trail.server");
      await releaseOpLock(lockKey);
    }
  }
}

async function runHeal(
  lic: HealLicense,
  opts?: { reason?: string; forceRecreate?: boolean },
): Promise<HealResult> {
  /*
   * Reparo baseado no código real do painel (createacc.php):
   *   - `update`  troca a senha → "Password updated successfully!" (prova que a
   *     conta existe E que a senha da licença foi gravada).
   *   - `add`     em conta vencida/"removida" → "subscription Updated." (reativa
   *     subtype + data); em conta ativa → "already in use and active";
   *     em conta inexistente → cria ("Account created successfully!").
   *   - `cexpire` só troca a data.
   *   - `remove`  NÃO apaga (só vence a conta) — por isso o reparo nunca usa.
   * Tudo acontece SOMENTE no servidor da própria licença.
   */
  const reason = opts?.reason ?? "self_repair";
  const steps: string[] = [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const y = await import("./yaarsa.server");
  try { await y.refreshPanelOverrides(); } catch { /* segue com o ambiente */ }

  let panel = normalizePanel(lic.panel);
  if (lic.panel && lic.panel !== panel) steps.push(`painel-desconhecido:${lic.panel}`);
  // O cliente entra no BTmob pelo IP que aparece na licença. Se esse IP é de
  // outro servidor, é LÁ que o login precisa funcionar (havia licenças
  // vitalícias marcadas como 4.5.5 mostrando o IP da 4.6). Trials sempre foram
  // criados no servidor da licença, então para eles só corrigimos o IP.
  if (!lic.is_trial && lic.server_ip) {
    let ipPanel: ReturnType<typeof y.panelForHost> = null;
    try { ipPanel = y.panelForHost(lic.server_ip); } catch { ipPanel = null; }
    if (ipPanel && ipPanel !== panel) {
      steps.push(`servidor-pelo-ip:${panel}->${ipPanel}`);
      panel = ipPanel;
    }
  }
  let serverIp: string | null = lic.server_ip ?? null;
  try {
    const host = typeof y.panelServerHost === "function" ? y.panelServerHost(panel) : null;
    if (host && host !== serverIp) {
      steps.push(`ip-corrigido:${serverIp ?? "vazio"}->${host}`);
      serverIp = host;
    }
  } catch { /* mantém o IP gravado */ }
  const ipChanged = serverIp !== (lic.server_ip ?? null) && !!lic.server_ip;
  const txt = (r: any) => String(r?.Success ?? r?.Fail ?? "").replace(/["']/g, "").trim();

  const targetYmd = panelExpireDateFor({
    expires_at: lic.expires_at,
    plan_slug: lic.plan_slug,
    is_trial: lic.is_trial,
    server_paid_until: (lic as any).server_paid_until ?? null,
  });

  let password: string | null = null;
  if (lic.yaarsa_password_enc) {
    try { password = y.decrypt(lic.yaarsa_password_enc); } catch { password = null; }
  }
  if (!password || !lic.yaarsa_email || !lic.yaarsa_username) {
    await logHeal(supabaseAdmin, lic, panel, "missing_credentials", reason, steps);
    throw new Error(
      "Esta licença não tem todas as credenciais originais salvas. Nenhum login novo foi criado; atualize a senha na ficha do cliente e tente novamente.",
    );
  }
  const email = lic.yaarsa_email;
  const username = y.sanitizePanelUsername(lic.yaarsa_username);

  // Senha fora da regra do painel nunca seria aceita: emitimos uma nova (que
  // passa a ser a senha exibida na licença).
  let passwordChanged = false;
  if (!y.isPanelPasswordValid(password)) {
    password = y.generateCredentials().password;
    passwordChanged = true;
    steps.push("senha-fora-da-regra-do-painel:nova-emitida");
  }

  const call = async <T,>(label: string, fn: () => Promise<T>): Promise<T | { Fail: string }> => {
    try { return await fn(); } catch (e: any) {
      steps.push(`${label}-erro:${String(e?.message ?? e).slice(0, 60)}`);
      return { Fail: String(e?.message ?? e) };
    }
  };

  // 1) Reaplica a senha da licença. Também descobre se a conta existe.
  let upd: any = await call("senha", () => y.yaarsaUpdatePassword(email, password!, panel));
  steps.push(`senha-resposta:${txt(upd).slice(0, 60) || "vazia"}`);
  let exists: boolean;
  if (/password updated/i.test(txt(upd))) exists = true;
  else if (NOT_FOUND_RE.test(txt(upd))) exists = false;
  else {
    await logHeal(supabaseAdmin, lic, panel, "unreachable", reason, steps);
    throw new Error(
      `O servidor ${panel} não respondeu como esperado agora (${txt(upd).slice(0, 100) || "sem resposta"}). Nada foi alterado — tente de novo em alguns minutos.`,
    );
  }

  let action: HealAction = "already_ok";
  if (!exists) {
    // 2a) Conta não existe neste servidor: cria com as credenciais da licença.
    const created: any = await call("criacao", () =>
      y.yaarsaCreateAccount({
        username, email, password: password!,
        planSlug: lic.plan_slug || (lic.is_trial ? "trial" : "login-30d"),
        totalPaid: 0,
        additionalInfo: `shadow-heal-${lic.id.slice(0, 8)}`,
        panel,
        expireDate: targetYmd,
      }),
    );
    steps.push(`criacao-resposta:${txt(created).slice(0, 60) || "vazia"}`);
    if (!/account created/i.test(txt(created))) {
      await logHeal(supabaseAdmin, lic, panel, "failed", reason, steps);
      throw new Error(
        QUOTA_RE.test(txt(created))
          ? `O servidor ${panel} está com a cota de contas cheia. Libere espaço no painel e tente de novo.`
          : `O servidor ${panel} não criou o login: ${txt(created).slice(0, 120) || "sem resposta"}.`,
      );
    }
    action = "created";
  } else {
    // 2b) Conta existe: reativa (se vencida/"removida") e acerta a data.
    const ext: any = await call("validade", () => y.yaarsaExtend(email, targetYmd, panel));
    steps.push(`validade-resposta:${targetYmd}:${txt(ext).slice(0, 60) || "vazia"}`);
    if (!/updated successfully|subscription updated/i.test(txt(ext))) {
      await logHeal(supabaseAdmin, lic, panel, "expire_failed", reason, steps);
      throw new Error(
        `A senha foi reaplicada, mas o servidor ${panel} não confirmou a validade ${targetYmd} (${txt(ext).slice(0, 80) || "sem resposta"}). Tente de novo em alguns minutos.`,
      );
    }
    if (/reativada|status renovado/i.test(txt(ext))) { steps.push("conta-reativada"); action = "recreated"; }
    // 3) Reaplica a senha depois da reativação — nada pode sobrescrevê-la.
    upd = await call("senha-final", () => y.yaarsaUpdatePassword(email, password!, panel));
    if (!/password updated/i.test(txt(upd))) {
      await logHeal(supabaseAdmin, lic, panel, "password_apply_failed", reason, steps);
      throw new Error("O servidor não confirmou a senha da licença. Não marquei o reparo como concluído.");
    }
    steps.push("senha-confirmada");
  }

  // 4) Equipe: libera o aparelho preso (erro de "outro dispositivo").
  if (reason !== "self_repair") {
    const rd: any = await call("aparelho", () => y.yaarsaResetDevice(email, panel));
    steps.push(`aparelho-liberado:${/reset successfully/i.test(txt(rd)) ? "sim" : "nao"}`);
  }

  await updateLicenseTolerant(supabaseAdmin, lic.id, {
    yaarsa_username: username,
    ...(passwordChanged ? { yaarsa_password_enc: y.encrypt(password) } : {}),
    panel,
    ...(serverIp ? { server_ip: serverIp } : {}),
    revoked: false,
  });
  steps.push("licenca-atualizada");
  await logHeal(supabaseAdmin, lic, panel, action, reason, steps);

  const base =
    action === "created"
      ? "Sua conta não existia no servidor e foi criada agora."
      : action === "recreated"
        ? "Sua conta estava desativada no servidor e foi reativada."
        : "Sua conta foi conferida no servidor.";
  return {
    ok: true,
    action,
    panel,
    credentials: { username, email, password, server_ip: serverIp },
    message: `${base} Senha confirmada e validade ajustada para ${targetYmd.split("-").reverse().join("/")}.${passwordChanged ? " ATENÇÃO: a senha mudou — use a que aparece agora em Licenças." : " Use o mesmo e-mail e senha no BTmob."}${ipChanged ? ` ATENÇÃO: o servidor certo é ${serverIp} — use esse IP no BTmob.` : ""}`,
    steps,
  };
}

async function logHeal(
  supabaseAdmin: any,
  lic: HealLicense,
  panel: string,
  outcome: string,
  reason: string,
  steps: string[],
) {
  try {
    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${panel}`,
      action: "license_heal_login",
      outcome,
      user_id: lic.user_id ?? null,
      context: { license_id: lic.id, reason, steps, plan_slug: lic.plan_slug },
    } as never);
  } catch {
    /* telemetria nunca derruba a correção */
  }
}
