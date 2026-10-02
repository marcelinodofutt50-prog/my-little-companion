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
  const reason = opts?.reason ?? "self_repair";
  const steps: string[] = [];
  if (lic.panel && !["v455", "v457", "v46"].includes(lic.panel)) {
    steps.push(`painel-desconhecido:${lic.panel}`);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const {
    yaarsaCreateAccount,
    yaarsaRemoveAccount,
    yaarsaSetPassword,
    yaarsaVerifyCredentials,
    yaarsaProbeAccount,
    yaarsaExtend,
    encrypt,
    decrypt,
    hasPanelServer,
    isPanelUsable,
    sanitizePanelUsername,
    isPanelHealthy,
    refreshPanelOverrides,
    looksLikePanelSuccess,
  } = await import("./yaarsa.server");

  const confirmed = (response: { Success?: unknown; Fail?: unknown }) =>
    Boolean(response.Success) || looksLikePanelSuccess(response.Fail);
  const subscriptionWasOnlyUpdated = (response: { Success?: unknown; Fail?: unknown }) =>
    /subscription\s+updated/i.test(String(response.Success ?? response.Fail ?? "").replace(/["']/g, ""));

  // Painéis sem VPS/admin key configurada não respondem. Nesse caso caímos no
  // painel que estiver realmente configurado, em vez de falhar para o cliente.
  try {
    await refreshPanelOverrides?.();
  } catch {
    /* segue com o ambiente */
  }
  // Correção manual nunca deve excluir um servidor apenas porque o disjuntor o
  // marcou como indisponível numa chamada anterior. Priorizamos os saudáveis,
  // mas ainda tentamos todos os servidores configurados antes de desistir.
  // Um painel serve se der para operar nele (endereço + admin key), mesmo que
  // ele não tenha VPS própria — a 4.5.5 usa a mesma máquina da 4.5.7.
  const hasServer = (p: "v455" | "v457" | "v46") =>
    typeof isPanelUsable === "function"
      ? isPanelUsable(p)
      : typeof hasPanelServer === "function"
        ? hasPanelServer(p)
        : true;
  const healthy = (p: "v455" | "v457" | "v46") =>
    typeof isPanelHealthy === "function" ? isPanelHealthy(p) : true;
  const preferred = normalizePanel(lic.panel);
  let panel = hasServer(preferred) && healthy(preferred)
    ? preferred
    : ((["v457", "v46", "v455"] as const).find((p) => hasServer(p) && healthy(p)) ?? preferred);
  if (panel !== preferred) steps.push(`painel-alternativo:${preferred}->${panel}`);

  const panelCandidates = () => {
    const all = [panel, preferred, "v457", "v46", "v455"] as const;
    const unique = all.filter((p, index) => all.indexOf(p) === index && hasServer(p));
    return [...unique.filter(healthy), ...unique.filter((p) => !healthy(p))];
  };



  const targetYmd = panelExpireDateFor({
    expires_at: lic.expires_at,
    plan_slug: lic.plan_slug,
    is_trial: lic.is_trial,
    server_paid_until: (lic as any).server_paid_until ?? null,
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
  //    credenciais que o cliente vê no site. Se o painel preferido devolver
  //    erro interno (PHP), consultamos a conta e tentamos os outros servidores
  //    antes de desistir — antes disso o cliente via só "não respondeu".
  if (canProbeExisting) {
    const tryPanels = panelCandidates();
    let created: { Success?: unknown; Fail?: unknown } = { Fail: "" };
    let exists = false;
    let lastCreateFail = "";

    for (const candidate of tryPanels) {
      let attempt: { Success?: unknown; Fail?: unknown };
      try {
        attempt = await yaarsaCreateAccount({
          username: sanitizePanelUsername(lic.yaarsa_username as string),
          email: lic.yaarsa_email as string,
          password: currentPassword as string,
          planSlug: lic.plan_slug || (lic.is_trial ? "trial" : "login-30d"),
          totalPaid: 0,
          additionalInfo: `shadow-heal-${lic.id.slice(0, 8)}`,
          panel: candidate,
          expireDate: targetYmd,
        });
      } catch (e: any) {
        attempt = { Fail: String(e?.message ?? e) };
      }

      const failText = String(attempt.Fail ?? "");
      if (confirmed(attempt) || EXISTS_RE.test(failText)) {
        panel = candidate;
        created = attempt;
        // Em `add`, "subscription Updated" prova que o cadastro já existia;
        // não prova que a senha enviada foi gravada. Ele precisa seguir pelo
        // reparo completo, em vez de encerrar com um sucesso falso.
        exists = !confirmed(attempt) || subscriptionWasOnlyUpdated(attempt);
        break;
      }

      lastCreateFail = failText;
      steps.push(`criacao-falhou-${candidate}:${failText.slice(0, 60)}`);

      // Erro interno do painel não significa que a conta não existe: conferimos.
      const probe = await yaarsaProbeAccount(lic.yaarsa_email as string, candidate);
      steps.push(`sondagem-${candidate}:${probe.state}`);
      if (probe.state === "found") {
        panel = candidate;
        created = { Fail: "1004 already in use (confirmado por sondagem)" };
        exists = true;
        break;
      }
    }

    if (confirmed(created) && !exists) {
      steps.push("conta-criada-no-painel");
      const probe = await yaarsaProbeAccount(lic.yaarsa_email as string, panel);
      steps.push(`conferencia:${probe.state}`);
      if (probe.state === "missing") {
        await logHeal(supabaseAdmin, lic, panel, "ghost_create", reason, steps);
        throw new Error(
          `O servidor ${panel} disse que criou a conta, mas ela não aparece no painel. Não mexi em mais nada — verifique o painel antes de tentar de novo.`,
        );
      }
      // O painel corta o usuário em 8 caracteres: a licença precisa mostrar
      // exatamente o que existe lá, senão o cliente tenta entrar com outro nome.
      const panelUsername = sanitizePanelUsername(lic.yaarsa_username as string);
      if (panelUsername !== lic.yaarsa_username) {
        await updateLicenseTolerant(supabaseAdmin, lic.id, { yaarsa_username: panelUsername });
        steps.push("usuario-ajustado-ao-painel");
      }
      const passwordResult = await yaarsaSetPassword(
        lic.yaarsa_email as string,
        currentPassword as string,
        panel,
        panelUsername,
        targetYmd,
      );
      if (!confirmed(passwordResult)) {
        await logHeal(supabaseAdmin, lic, panel, "password_apply_failed", reason, steps);
        throw new Error(`A conta foi encontrada, mas o painel não confirmou a senha: ${String(passwordResult.Fail ?? "sem resposta").slice(0, 120)}.`);
      }
      steps.push("senha-reaplicada");
      const passwordCheck = await yaarsaVerifyCredentials(lic.yaarsa_email as string, currentPassword as string, panel);
      if (passwordCheck.available && !passwordCheck.verified) {
        await logHeal(supabaseAdmin, lic, panel, "password_mismatch", reason, steps);
        throw new Error("O painel respondeu, mas a senha ainda não ficou igual à mostrada na licença. Não marquei o reparo como concluído.");
      }
      steps.push(passwordCheck.available ? "senha-confirmada" : "senha-aplicada-sem-leitura");
      // Validade por último: a troca de senha não pode sobrescrever a data.
      try {
        const ext: any = await yaarsaExtend(lic.yaarsa_email as string, targetYmd, panel);
        steps.push(ext?.Fail && !looksLikePanelSuccess(ext.Fail) ? "validade-nao-ajustada" : "validade-ajustada");
      } catch {
        steps.push("validade-nao-ajustada");
      }
      await logHeal(supabaseAdmin, lic, panel, "created", reason, steps);
      return {
        ok: true,
        action: "created",
        panel,
        credentials: {
          username: sanitizePanelUsername(lic.yaarsa_username as string),
          email: lic.yaarsa_email as string,
          password: currentPassword as string,
          server_ip: lic.server_ip ?? null,
        },
        message:
          "Sua conta não existia no servidor e acabou de ser criada com o mesmo e-mail e senha. Tente entrar de novo no BTmob.",
        steps,
        warning: steps.includes("validade-nao-ajustada") ? "Login recuperado, mas a validade ainda precisa ser sincronizada." : undefined,
      };
    }

    if (!exists) {
      // Nenhum servidor respondeu de forma útil: não mexemos em nada.
      const fail = lastCreateFail;
      await logHeal(supabaseAdmin, lic, panel, "unreachable", reason, [...steps, fail.slice(0, 200)]);
      throw new Error(
        `O servidor de licenças não respondeu agora (tentei todos os servidores disponíveis)${fail ? `: ${fail.slice(0, 160)}` : ""}. Tente novamente em alguns minutos ou fale com o suporte.`,
      );
    }
    steps.push("conta-ja-existia");

  } else {
    steps.push(opts?.forceRecreate ? "recriacao-forcada" : "sem-credenciais-guardadas");
  }

  // 2) A conta existe no painel mas está inconsistente. Regra do time: NÃO
  //    inventamos login novo — apagamos e recriamos com as MESMAS credenciais
  //    que já estão na licença, para o cliente não precisar trocar nada.
  // Uma correção nunca pode trocar silenciosamente o login exibido ao cliente.
  // Se os dados antigos não puderem ser recuperados, paramos para intervenção
  // do suporte em vez de criar uma conta diferente.
  if (!currentPassword || !lic.yaarsa_email || !lic.yaarsa_username) {
    await logHeal(supabaseAdmin, lic, panel, "missing_credentials", reason, steps);
    throw new Error(
      "Esta licença não tem todas as credenciais originais salvas. Nenhum login novo foi criado; atualize a senha na ficha do cliente e tente novamente.",
    );
  }
  const generated = false;
  const username = sanitizePanelUsername(lic.yaarsa_username);
  const email = lic.yaarsa_email;
  const password = currentPassword;

  const panelOrder = panelCandidates();

  // Apaga a conta bugada onde ela realmente existe. Antes apagávamos em todos
  // os painéis "no escuro": se a recriação falhasse depois, o cliente ficava
  // sem conta nenhuma. Agora só removemos onde a sondagem confirma a conta.
  const removedFrom: Array<"v455" | "v457" | "v46"> = [];
  const stuckIn: Array<"v455" | "v457" | "v46"> = [];
  if (!generated) {
    for (const candidate of panelOrder) {
      let present = true;
      try {
        const probe = await yaarsaProbeAccount(email, candidate);
        present = probe.state === "found";
        if (probe.state === "unknown") present = candidate === panel; // painel mudo: só o preferido
      } catch {
        present = candidate === panel;
      }
      if (!present) continue;
      // Remove e só segue com CONFIRMAÇÃO DUPLA: o painel tem que responder que
      // removeu (ex.: "client removed") E a consulta seguinte tem que dizer que
      // o e-mail não existe mais. Painel mudo NÃO conta como removido.
      let gone = false;
      for (let tryN = 0; tryN < 3 && !gone; tryN++) {
        let saidRemoved = false;
        try {
          const removed = await yaarsaRemoveAccount(email, candidate);
          const txt = String(removed.Success ?? removed.Fail ?? "");
          saidRemoved =
            /remov|delet|apagad/i.test(txt) || NOT_FOUND_RE.test(txt) || looksLikePanelSuccess(txt);
          steps.push(`remocao-resposta-${candidate}:${txt.replace(/["']/g, "").slice(0, 60) || "vazia"}`);
        } catch (e: any) {
          steps.push(`remocao-erro-${candidate}:${String(e?.message ?? e).slice(0, 60)}`);
        }
        await new Promise((r) => setTimeout(r, 600));
        let state: "found" | "missing" | "unknown" = "unknown";
        try {
          state = (await yaarsaProbeAccount(email, candidate)).state;
        } catch {
          state = "unknown";
        }
        steps.push(`remocao-conferida-${candidate}:${state}`);
        gone = state === "missing" && saidRemoved;
        // Sem a palavra "removed", mas a consulta confirma que sumiu: aceita.
        if (state === "missing") gone = true;
        if (!gone) await new Promise((r) => setTimeout(r, 900));
      }
      if (gone) {
        removedFrom.push(candidate);
        steps.push(`conta-removida-confirmada:${candidate}`);
      } else {
        steps.push(`remocao-nao-confirmada:${candidate}`);
        stuckIn.push(candidate);
      }
    }
  }

  // Sem confirmação de que o login antigo saiu, NÃO criamos nada: criar agora
  // geraria login duplicado ou "já existe" fingindo sucesso.
  if (stuckIn.length) {
    await logHeal(supabaseAdmin, lic, panel, "remove_not_confirmed", reason, steps);
    throw new Error(
      `O painel ${stuckIn.join(", ")} não confirmou que apagou o login antigo, então não recriei nada para não duplicar. Tente de novo em alguns minutos.`,
    );
  }

  let usedPanel: "v455" | "v457" | "v46" = panel;
  let lastFail = "";
  let issued = false;
  // Recria primeiro exatamente onde o login foi apagado.
  const createOrder = [...removedFrom, ...panelOrder.filter((p) => !removedFrom.includes(p))];
  for (const candidate of createOrder) {
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
        expireDate: targetYmd,
      });
    } catch (e: any) {
      fresh = { Fail: String(e?.message ?? e) };
    }

    if (confirmed(fresh) || EXISTS_RE.test(String(fresh.Fail ?? ""))) {
      // Confirmação obrigatória: só damos por resolvido se o painel realmente
      // devolver a conta na consulta (era aqui que "corrigia" sem existir).
      const probe = await yaarsaProbeAccount(email, candidate);
      steps.push(`conferencia-${candidate}:${probe.state}`);
      if (probe.state === "missing") {
        lastFail = `conta não apareceu no painel ${candidate}`;
        continue;
      }
      // Criar/encontrar a conta não garante a senha. Sempre reaplicamos a
      // senha exibida na licença e recusamos sucesso se o painel a rejeitar.
      try {
        const passwordResult = await yaarsaSetPassword(email, password, candidate, username, targetYmd);
        if (!confirmed(passwordResult)) {
          lastFail = `senha não confirmada no painel ${candidate}: ${String(passwordResult.Fail ?? "sem resposta").slice(0, 90)}`;
          steps.push(`senha-reaplicada-falhou-${candidate}`);
          // A conta foi localizada neste servidor. Não podemos criar uma cópia
          // em outro e trocar o painel da licença só porque a senha falhou aqui.
          break;
        }
        steps.push(`senha-reaplicada:${candidate}`);
        const passwordCheck = await yaarsaVerifyCredentials(email, password, candidate);
        if (passwordCheck.available && !passwordCheck.verified) {
          lastFail = `senha diferente no painel ${candidate}`;
          steps.push(`senha-divergente:${candidate}`);
          break;
        }
        steps.push(passwordCheck.available ? `senha-confirmada:${candidate}` : `senha-aplicada-sem-leitura:${candidate}`);
      } catch (e: any) {
        lastFail = `falha ao reaplicar senha no painel ${candidate}: ${String(e?.message ?? e).slice(0, 90)}`;
        steps.push(`senha-reaplicada-erro-${candidate}`);
        break;
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
    // Última linha de defesa: se apagamos a conta e nenhuma recriação passou,
    // tentamos devolver a conta ao painel de origem para o cliente não ficar
    // sem acesso nenhum por causa da tentativa de correção.
    let restored = false;
    for (const candidate of removedFrom) {
      try {
        const back = await yaarsaCreateAccount({
          username,
          email,
          password,
          planSlug: lic.plan_slug || (lic.is_trial ? "trial" : "login-30d"),
          totalPaid: 0,
          additionalInfo: `shadow-heal-restore-${lic.id.slice(0, 8)}`,
          panel: candidate,
          expireDate: targetYmd,
        });
        if (confirmed(back) || EXISTS_RE.test(String(back.Fail ?? ""))) {
          const probe = await yaarsaProbeAccount(email, candidate);
          if (probe.state !== "missing") {
            restored = true;
            steps.push(`conta-restaurada:${candidate}`);
            try { await yaarsaExtend(email, targetYmd, candidate); } catch { /* best-effort */ }
            break;
          }
        }
      } catch (e: any) {
        steps.push(`restauracao-erro-${candidate}:${String(e?.message ?? e).slice(0, 60)}`);
      }
    }
    if (removedFrom.length && !restored) steps.push("ATENCAO:conta-removida-sem-restauracao");

    await logHeal(
      supabaseAdmin,
      lic,
      panel,
      removedFrom.length && !restored ? "failed_account_lost" : "failed",
      reason,
      [...steps, lastFail.slice(0, 200)],
    );
    if (removedFrom.length && !restored) {
      throw new Error(
        "Os servidores recusaram a recriação e não consegui devolver a conta ao painel. As credenciais continuam as mesmas — acione o suporte para recriar manualmente antes de tentar de novo.",
      );
    }
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
    warning: steps.includes("validade-nao-ajustada") ? "Login recuperado, mas a validade ainda precisa ser sincronizada." : undefined,
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
