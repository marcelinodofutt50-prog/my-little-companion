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

function normalizePanel(p: string | null | undefined): "v455" | "v457" | "v46" {
  return p === "v46" ? "v46" : p === "v455" ? "v455" : "v457";
}

/**
 * Repara o login de UMA licença. Nunca deixa o cliente sem credenciais
 * funcionais: ou a conta antiga passa a existir, ou uma nova é emitida.
 */
export async function healLicenseLogin(
  lic: HealLicense,
  opts?: { reason?: string; forceRecreate?: boolean },
): Promise<HealResult> {
  const reason = opts?.reason ?? "self_repair";
  const steps: string[] = [];

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const {
    yaarsaCreateAccount,
    yaarsaRemoveAccount,
    yaarsaProbeAccount,
    yaarsaExtend,
    generateCredentials,
    encrypt,
    decrypt,
    hasPanelServer,
    isPanelHealthy,
    refreshPanelOverrides,
  } = await import("./yaarsa.server");

  // Painéis sem VPS/admin key configurada não respondem. Nesse caso caímos no
  // painel que estiver realmente configurado, em vez de falhar para o cliente.
  try {
    await refreshPanelOverrides?.();
  } catch {
    /* segue com o ambiente */
  }
  const configured = (p: "v455" | "v457" | "v46") =>
    (typeof hasPanelServer === "function" ? hasPanelServer(p) : true) &&
    (typeof isPanelHealthy === "function" ? isPanelHealthy(p) : true);
  const preferred = normalizePanel(lic.panel);
  const panel = configured(preferred)
    ? preferred
    : ((["v457", "v46", "v455"] as const).find(configured) ?? preferred);
  if (panel !== preferred) steps.push(`painel-alternativo:${preferred}->${panel}`);



  const targetYmd = panelExpireDateFor({
    expires_at: lic.expires_at,
    plan_slug: lic.plan_slug,
  });

  let currentPassword: string | null = null;
  if (lic.yaarsa_password_enc) {
    try {
      currentPassword = decrypt(lic.yaarsa_password_enc);
    } catch {
      currentPassword = null;
    }
  }

  const canProbeExisting =
    !opts?.forceRecreate && !!lic.yaarsa_email && !!currentPassword && !!lic.yaarsa_username;

  // 1) A conta existe no painel? Descobrimos tentando criá-la com as mesmas
  //    credenciais que o cliente vê no site.
  if (canProbeExisting) {
    let created: { Success?: unknown; Fail?: unknown };
    try {
      created = await yaarsaCreateAccount({
        username: lic.yaarsa_username as string,
        email: lic.yaarsa_email as string,
        password: currentPassword as string,
        planSlug: lic.plan_slug || (lic.is_trial ? "trial" : "login-30d"),
        totalPaid: 0,
        additionalInfo: `shadow-heal-${lic.id.slice(0, 8)}`,
        panel,
      });
    } catch (e: any) {
      created = { Fail: String(e?.message ?? e) };
    }

    if (created.Success) {
      steps.push("conta-criada-no-painel");
      const probe = await yaarsaProbeAccount(lic.yaarsa_email as string, panel);
      steps.push(`conferencia:${probe.state}`);
      if (probe.state === "missing") {
        await logHeal(supabaseAdmin, lic, panel, "ghost_create", reason, steps);
        throw new Error(
          `O servidor ${panel} disse que criou a conta, mas ela não aparece no painel. Não mexi em mais nada — verifique o painel antes de tentar de novo.`,
        );
      }
      try {
        await yaarsaExtend(lic.yaarsa_email as string, targetYmd, panel);
        steps.push("validade-ajustada");
      } catch {
        steps.push("validade-nao-ajustada");
      }
      await logHeal(supabaseAdmin, lic, panel, "created", reason, steps);
      return {
        ok: true,
        action: "created",
        panel,
        credentials: {
          username: lic.yaarsa_username as string,
          email: lic.yaarsa_email as string,
          password: currentPassword as string,
          server_ip: lic.server_ip ?? null,
        },
        message:
          "Sua conta não existia no servidor e acabou de ser criada com o mesmo e-mail e senha. Tente entrar de novo no BTmob.",
        steps,
      };
    }

    const fail = String(created.Fail ?? "");
    if (!EXISTS_RE.test(fail)) {
      // Painel fora do ar / chave inválida: não mexemos em nada.
      await logHeal(supabaseAdmin, lic, panel, "unreachable", reason, [...steps, fail.slice(0, 200)]);
      throw new Error(
        `O servidor de licenças (${panel}) não respondeu agora${fail ? `: ${fail.slice(0, 160)}` : ""}. Tente novamente em alguns minutos ou fale com o suporte.`,
      );
    }
    steps.push("conta-ja-existia");

  } else {
    steps.push(opts?.forceRecreate ? "recriacao-forcada" : "sem-credenciais-guardadas");
  }

  // 2) A conta existe no painel mas está inconsistente. Regra do time: NÃO
  //    inventamos login novo — apagamos e recriamos com as MESMAS credenciais
  //    que já estão na licença, para o cliente não precisar trocar nada.
  const { generated, username, email, password } = (() => {
    if (currentPassword && lic.yaarsa_email && lic.yaarsa_username) {
      return {
        generated: false,
        username: lic.yaarsa_username as string,
        email: lic.yaarsa_email as string,
        password: currentPassword,
      };
    }
    const c = generateCredentials();
    return { generated: true, username: c.username, email: c.email, password: c.password };
  })();
  if (generated) steps.push("sem-senha-guardada:credenciais-novas");

  const panelOrder = [panel, ...(["v457", "v46", "v455"] as const).filter((p) => p !== panel && configured(p))];

  // Apaga a conta bugada em TODOS os painéis configurados, senão a recriação
  // volta a bater em "e-mail já em uso".
  if (!generated) {
    for (const candidate of panelOrder) {
      try {
        const removed = await yaarsaRemoveAccount(email, candidate);
        if (removed.Fail && !NOT_FOUND_RE.test(String(removed.Fail))) {
          steps.push(`remocao-${candidate}:${String(removed.Fail).slice(0, 60)}`);
        } else if (removed.Success) {
          steps.push(`conta-removida:${candidate}`);
        }
      } catch (e: any) {
        steps.push(`remocao-erro-${candidate}:${String(e?.message ?? e).slice(0, 60)}`);
      }
    }
  }

  let usedPanel: "v455" | "v457" | "v46" = panel;
  let lastFail = "";
  let issued = false;
  for (const candidate of panelOrder) {
    let fresh: { Success?: unknown; Fail?: unknown };
    try {
      fresh = await yaarsaCreateAccount({
        username,
        email,
        password,
        planSlug: lic.plan_slug || (lic.is_trial ? "trial" : "login-30d"),
        totalPaid: 0,
        additionalInfo: `shadow-heal-new-${lic.id.slice(0, 8)}`,
        panel: candidate,
      });
    } catch (e: any) {
      fresh = { Fail: String(e?.message ?? e) };
    }

    if (fresh.Success || EXISTS_RE.test(String(fresh.Fail ?? ""))) {
      // Confirmação obrigatória: só damos por resolvido se o painel realmente
      // devolver a conta na consulta (era aqui que "corrigia" sem existir).
      const probe = await yaarsaProbeAccount(email, candidate);
      steps.push(`conferencia-${candidate}:${probe.state}`);
      if (probe.state === "missing") {
        lastFail = `conta não apareceu no painel ${candidate}`;
        continue;
      }
      usedPanel = candidate;
      issued = true;
      if (candidate !== panel) steps.push(`login-recriado-em:${candidate}`);
      break;
    }

    lastFail = String(fresh.Fail ?? "");
    steps.push(`falha-${candidate}:${lastFail.slice(0, 60)}`);
  }

  if (!issued) {
    await logHeal(supabaseAdmin, lic, panel, "failed", reason, [...steps, lastFail.slice(0, 200)]);
    throw new Error(
      QUOTA_RE.test(lastFail)
        ? "Os servidores estão com a cota de contas cheia agora. Libere espaço no painel e tente de novo — as credenciais do cliente não foram alteradas."
        : `Não consegui recriar o login no painel${lastFail ? `: ${lastFail.slice(0, 140)}` : ""}. As credenciais do cliente continuam as mesmas.`,
    );
  }
  steps.push(generated ? "login-novo-emitido" : "login-recriado-mesmas-credenciais");

  try {
    await yaarsaExtend(email, targetYmd, usedPanel);
    steps.push("validade-ajustada");
  } catch {
    steps.push("validade-nao-ajustada");
  }

  await updateLicenseTolerant(supabaseAdmin, lic.id, {
    yaarsa_username: username,
    yaarsa_email: email,
    yaarsa_password_enc: encrypt(password),
    panel: usedPanel,
    revoked: false,
    suspended_at: null,
  });
  steps.push("licenca-atualizada");

  await logHeal(supabaseAdmin, lic, usedPanel, "recreated", reason, steps);

  return {
    ok: true,
    action: "recreated",
    panel: usedPanel,
    credentials: {
      username,
      email,
      password,
      server_ip: lic.server_ip ?? null,
    },
    message: generated
      ? "A licença não tinha senha guardada, então emitimos um login novo — use o e-mail e a senha que aparecem agora em Licenças."
      : "O login estava travado no servidor. Apagamos e recriamos a conta com o MESMO e-mail e a MESMA senha. Tente entrar de novo no BTmob.",
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
