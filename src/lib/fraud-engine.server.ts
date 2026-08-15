/**
 * Motor antifraude multicamadas (somente servidor).
 *
 * Objetivo: um benefício grátis por PESSOA (teste de licença e APK grátis do
 * Play Protect), sem barrar cliente real que chega pela primeira vez.
 *
 * Camadas (nenhuma decide sozinha, exceto as provas fortes):
 *  1. Aparelho  — deviceId persistido (localStorage + cookie) → hash com salt.
 *  2. Perfil de hardware/navegador (attrs) — sobrevive à limpeza de dados.
 *  3. Rede — IP exato (camada antiga, mantida) + faixa /24 (IPv4) ou /48 (IPv6).
 *  4. Identidade — e-mail canônico (Gmail com pontos/+alias é a mesma caixa)
 *     e domínios descartáveis.
 *  5. Grafo de contas — contas que compartilham aparelho/rede e já consumiram
 *     o benefício ligam os pontos entre si.
 *
 * Provas fortes negam na hora. O resto soma pontos: só nega acima do limite,
 * então um usuário legítimo isolado passa com score 0.
 */
import { resolveHashSalt } from "./antifraud.server";
import { clientIp, clientUserAgent, hashIp, isAllowlisted } from "./antifraud.server";
import { canonicalEmail } from "./email-canonical";

export type FraudAction = "trial" | "play_protect";

export type DeviceInput = { deviceId?: string | null; attrs?: string | null } | null | undefined;

export type FraudVerdict = {
  allowed: boolean;
  score: number;
  reasons: string[];
  message?: string;
  deviceHash: string | null;
  attrsHash: string | null;
  ipHash: string | null;
  ipPrefixHash: string | null;
};

/** Acima disso o pedido é negado (soma de sinais fracos). */
const DENY_SCORE = 60;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "yopmail.com", "trashmail.com", "getnada.com", "sharklasers.com",
  "dispostable.com", "maildrop.cc", "fakeinbox.com", "throwawaymail.com",
  "mohmal.com", "emailondeck.com", "moakt.com", "tempr.email", "mailnesia.com",
  "spam4.me", "grr.la", "inboxkitten.com", "email-temp.com", "tmpmail.org",
]);

/** Faixa de rede: /24 no IPv4, /48 no IPv6. Mesma operadora/casa, não pessoa. */
export function ipPrefix(ip: string): string | null {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (ip.includes(":")) {
    const groups = ip.split(":").filter(Boolean).slice(0, 3);
    if (groups.length === 3) return `${groups.join(":")}::/48`;
  }
  return null;
}

async function sha(value: string): Promise<string> {
  const salt = resolveHashSalt();
  const bytes = new TextEncoder().encode(`${value}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type SignalContext = {
  deviceHash: string | null;
  attrsHash: string | null;
  ipHash: string | null;
  ipPrefixHash: string | null;
  userAgent: string | null;
  allowlisted: boolean;
};

/** Calcula hashes da requisição atual. Nunca guarda valor em claro. */
export async function collectSignals(device: DeviceInput): Promise<SignalContext> {
  const ip = clientIp();
  const ipHash = ip ? await hashIp(ip) : null;
  const prefix = ip ? ipPrefix(ip) : null;
  const deviceId = (device?.deviceId ?? "").trim();
  const attrs = (device?.attrs ?? "").trim();
  return {
    deviceHash: deviceId.length >= 8 ? await sha(`dev:${deviceId}`) : null,
    attrsHash: attrs.length >= 16 ? await sha(`attrs:${attrs}`) : null,
    ipHash,
    ipPrefixHash: prefix ? await sha(`net:${prefix}`) : null,
    userAgent: clientUserAgent(),
    allowlisted: ipHash ? await isAllowlisted(ipHash) : false,
  };
}

/** Grava/atualiza a impressão digital do aparelho para este usuário. */
export async function recordDevice(userId: string, sig: SignalContext): Promise<void> {
  if (!sig.deviceHash && !sig.attrsHash) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const deviceHash = sig.deviceHash ?? `attrs:${sig.attrsHash}`;
    const { data: existing } = await supabaseAdmin
      .from("device_identities")
      .select("id, seen_count")
      .eq("user_id", userId)
      .eq("device_hash", deviceHash)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("device_identities")
        .update({
          seen_count: (existing as any).seen_count + 1,
          last_seen_at: new Date().toISOString(),
          ip_hash: sig.ipHash,
          ip_prefix_hash: sig.ipPrefixHash,
          attrs_hash: sig.attrsHash,
          user_agent: sig.userAgent,
        } as any)
        .eq("id", (existing as any).id);
      return;
    }

    await supabaseAdmin.from("device_identities").insert({
      user_id: userId,
      device_hash: deviceHash,
      attrs_hash: sig.attrsHash,
      ip_hash: sig.ipHash,
      ip_prefix_hash: sig.ipPrefixHash,
      user_agent: sig.userAgent,
    } as any);
  } catch (e) {
    console.error("[fraud-engine] recordDevice falhou:", e);
  }
}

async function usersWhoConsumed(action: FraudAction, userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const table = action === "trial" ? "trials" : "apk_free_trials";
  const { data, error } = await supabaseAdmin
    .from(table as any)
    .select("user_id")
    .in("user_id", userIds);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
}

async function logAssessment(
  userId: string,
  action: FraudAction,
  verdict: FraudVerdict,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("fraud_assessments").insert({
      user_id: userId,
      action,
      decision: verdict.allowed ? "allow" : "deny",
      score: verdict.score,
      reasons: verdict.reasons,
      device_hash: verdict.deviceHash,
      attrs_hash: verdict.attrsHash,
      ip_hash: verdict.ipHash,
      ip_prefix_hash: verdict.ipPrefixHash,
    } as any);
  } catch (e) {
    console.error("[fraud-engine] logAssessment falhou:", e);
  }
}




/** Nome legível do benefício, usado nas mensagens ao cliente. */
function benefitLabel(action: FraudAction): string {
  return action === "trial" ? "o teste grátis de licença" : "o APK grátis do Play Protect";
}

/**
 * Explicação específica por motivo. O cliente precisa entender EXATAMENTE
 * o que foi detectado — mensagem genérica só gera ticket de suporte.
 */
const REASON_EXPLANATIONS: Record<string, string> = {
  device_already_used:
    "Este mesmo aparelho já resgatou o benefício em outra conta. O limite é de 1 por aparelho.",
  device_shared_with_consumer:
    "Este aparelho já foi usado por outra conta que resgatou o benefício, mesmo depois de limpar os dados do navegador.",
  same_inbox_already_used:
    "Este e-mail é uma variação (pontos ou +alias) de outra conta que já resgatou o benefício. Para nós é a mesma caixa de entrada.",
  disposable_email:
    "O domínio do seu e-mail é de e-mail temporário/descartável, que não é aceito para benefícios grátis.",
  email_alias_family: "Existem outras contas usando variações do seu e-mail.",
  device_shared: "Outras contas já usaram este mesmo aparelho.",
  same_hardware_same_network_consumer:
    "Detectamos o mesmo perfil de hardware e a mesma rede de outra conta que já resgatou o benefício.",
  same_hardware_same_network:
    "Detectamos o mesmo perfil de hardware e a mesma rede de outras contas.",
  no_device_signature:
    "Não conseguimos identificar seu aparelho (navegador anônimo, bloqueadores ou dados desativados).",
  no_network_signature: "Não conseguimos identificar sua conexão de rede.",
  multi_account_burst_same_device:
    "Várias contas novas foram criadas neste mesmo aparelho nos últimos 7 dias.",
};

function explainReason(reason: string): string {
  if (REASON_EXPLANATIONS[reason]) return REASON_EXPLANATIONS[reason]!;
  const ipReuse = reason.match(/^ip_reuse_(\d+)$/);
  if (ipReuse) {
    return `Outra(s) ${ipReuse[1]} conta(s) já usaram o benefício a partir do mesmo endereço de internet.`;
  }
  const cluster = reason.match(/^network_cluster_(\d+)$/);
  if (cluster) {
    return `Detectamos ${cluster[1]} contas diferentes criadas na sua faixa de rede nos últimos 30 dias.`;
  }
  return reason;
}

/** Código curto de protocolo para o cliente citar no suporte. */
function protocolCode(userId: string, action: FraudAction): string {
  const suffix = userId.replace(/-/g, "").slice(-6).toUpperCase();
  const day = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `${action === "trial" ? "TRL" : "APK"}-${day}-${suffix}`;
}

/** Monta a mensagem detalhada de negação, com motivo principal e protocolo. */
export function buildDenyMessage(
  action: FraudAction,
  reasons: string[],
  userId: string,
  score: number,
): string {
  const primary = reasons[reasons.length - 1] ?? "";
  const secondary = reasons.slice(0, -1).filter((r) => r !== "allowlisted");
  const lines = [
    `Não foi possível liberar ${benefitLabel(action)} para esta conta.`,
    "",
    `Motivo: ${explainReason(primary)}`,
  ];
  if (secondary.length) {
    lines.push(
      `Também observamos: ${secondary.map(explainReason).join(" ")}`,
    );
  }
  lines.push(
    "",
    "Regra: cada pessoa tem direito a um único benefício grátis. Se você comprar uma licença, o acesso é liberado na hora e sem verificação.",
    `Se isso for um engano (ex.: você divide a internet com outra pessoa), fale com o suporte citando o protocolo ${protocolCode(userId, action)} — nós liberamos manualmente.`,
  );
  return lines.join("\n");
}


/**
 * Avaliação principal. `allowed=false` só acontece com prova forte ou score alto.
 * Erro de infraestrutura nega temporariamente (fail-safe) com mensagem de retry.
 */
export async function assessAbuse(input: {
  userId: string;
  action: FraudAction;
  device: DeviceInput;
}): Promise<FraudVerdict> {
  let sig: SignalContext = {
    deviceHash: null, attrsHash: null, ipHash: null, ipPrefixHash: null,
    userAgent: null, allowlisted: false,
  };

  try {
    sig = await collectSignals(input.device);
    await recordDevice(input.userId, sig);

    const base = {
      deviceHash: sig.deviceHash,
      attrsHash: sig.attrsHash,
      ipHash: sig.ipHash,
      ipPrefixHash: sig.ipPrefixHash,
    };

    // Admin liberou essa conexão manualmente: passa direto.
    if (sig.allowlisted) {
      const verdict: FraudVerdict = { allowed: true, score: 0, reasons: ["allowlisted"], ...base };
      await logAssessment(input.userId, input.action, verdict);
      return verdict;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const reasons: string[] = [];
    let score = 0;
    const deny = async (reason: string): Promise<FraudVerdict> => {
      const all = [...reasons, reason];
      const verdict: FraudVerdict = {
        allowed: false,
        score: 100,
        reasons: all,
        message: buildDenyMessage(input.action, all, input.userId, 100),
        ...base,
      };

      await logAssessment(input.userId, input.action, verdict);
      return verdict;
    };

    const table = input.action === "trial" ? "trials" : "apk_free_trials";

    // ── Prova forte 1: este aparelho já consumiu o benefício em outra conta.
    if (sig.deviceHash) {
      const { data: sameDevice, error } = await supabaseAdmin
        .from(table as any)
        .select("user_id")
        .eq("device_hash", sig.deviceHash)
        .neq("user_id", input.userId)
        .limit(1);
      if (error) throw error;
      if (sameDevice && sameDevice.length > 0) return deny("device_already_used");
    }

    // ── Prova forte 2: e-mail canônico repetido (mesma caixa, contas diferentes).
    const { data: me, error: meErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, email_canonical, created_at")
      .eq("id", input.userId)
      .maybeSingle();
    if (meErr) throw meErr;

    const canonical = me?.email_canonical ?? (me?.email ? canonicalEmail(me.email) : null);
    if (canonical) {
      const domain = canonical.split("@")[1] ?? "";
      if (DISPOSABLE_DOMAINS.has(domain)) return deny("disposable_email");

      if (!me?.email_canonical) {
        await supabaseAdmin
          .from("profiles")
          .update({ email_canonical: canonical } as any)
          .eq("id", input.userId);
      }

      const { data: twins, error: twinErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email_canonical", canonical)
        .neq("id", input.userId)
        .limit(20);
      if (twinErr) throw twinErr;
      const twinIds = (twins ?? []).map((t: any) => t.id);
      if (twinIds.length > 0) {
        const consumed = await usersWhoConsumed(input.action, twinIds);
        if (consumed.length > 0) return deny("same_inbox_already_used");
        score += 25;
        reasons.push("email_alias_family");
      }
    }

    // ── Prova forte 3: contas que já dividiram este aparelho (histórico) e
    //    consumiram o benefício — pega quem apagou o storage depois do resgate.
    if (sig.deviceHash || sig.attrsHash) {
      const orFilters = [
        sig.deviceHash ? `device_hash.eq.${sig.deviceHash}` : null,
        sig.attrsHash ? `attrs_hash.eq.${sig.attrsHash}` : null,
      ].filter(Boolean).join(",");
      const { data: linked, error: linkErr } = await supabaseAdmin
        .from("device_identities")
        .select("user_id, attrs_hash, ip_prefix_hash, device_hash")
        .or(orFilters)
        .neq("user_id", input.userId)
        .limit(200);
      if (linkErr) throw linkErr;

      const byDevice = (linked ?? []).filter((r: any) => sig.deviceHash && r.device_hash === sig.deviceHash);
      const byAttrs = (linked ?? []).filter(
        (r: any) => sig.attrsHash && r.attrs_hash === sig.attrsHash,
      );

      if (byDevice.length > 0) {
        const consumed = await usersWhoConsumed(input.action, byDevice.map((r: any) => r.user_id));
        if (consumed.length > 0) return deny("device_shared_with_consumer");
        score += 35;
        reasons.push("device_shared");
      }

      // Mesmo perfil de hardware + mesma faixa de rede: forte, mas não prova.
      const sameHwSameNet = byAttrs.filter(
        (r: any) => sig.ipPrefixHash && r.ip_prefix_hash === sig.ipPrefixHash,
      );
      if (sameHwSameNet.length > 0) {
        const consumed = await usersWhoConsumed(
          input.action,
          Array.from(new Set(sameHwSameNet.map((r: any) => r.user_id))),
        );
        if (consumed.length > 0) {
          score += 45;
          reasons.push("same_hardware_same_network_consumer");
        } else {
          score += 15;
          reasons.push("same_hardware_same_network");
        }
      }
    }

    // ── Camada de IP (mantida e melhorada).
    if (sig.ipHash) {
      const { data: sameIp, error: ipErr } = await supabaseAdmin
        .from(table as any)
        .select("user_id")
        .eq("ip_hash", sig.ipHash)
        .neq("user_id", input.userId)
        .limit(5);
      if (ipErr) throw ipErr;
      if (sameIp && sameIp.length > 0) {
        // IP compartilhado existe (NAT de operadora), então pontua alto sem negar sozinho.
        score += sameIp.length > 1 ? 55 : 35;
        reasons.push(`ip_reuse_${sameIp.length}`);
      }
    }

    if (sig.ipPrefixHash) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: netAccounts, error: netErr } = await supabaseAdmin
        .from("device_identities")
        .select("user_id")
        .eq("ip_prefix_hash", sig.ipPrefixHash)
        .gte("first_seen_at", since)
        .limit(200);
      if (netErr) throw netErr;
      const distinct = new Set((netAccounts ?? []).map((r: any) => r.user_id));
      distinct.delete(input.userId);
      if (distinct.size >= 5) {
        score += 30;
        reasons.push(`network_cluster_${distinct.size}`);
      } else if (distinct.size >= 3) {
        score += 15;
        reasons.push(`network_cluster_${distinct.size}`);
      }
    }

    // ── Sem nenhuma assinatura de aparelho: cliente escondendo rastro.
    if (!sig.deviceHash && !sig.attrsHash) {
      score += 20;
      reasons.push("no_device_signature");
    }
    if (!sig.ipHash) {
      score += 20;
      reasons.push("no_network_signature");
    }

    // ── Conta recém-criada logo após outra conta do mesmo aparelho.
    if (me?.created_at && sig.deviceHash) {
      const { data: recentSameDevice, error: recentErr } = await supabaseAdmin
        .from("device_identities")
        .select("user_id, first_seen_at")
        .eq("device_hash", sig.deviceHash)
        .neq("user_id", input.userId)
        .gte("first_seen_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(10);
      if (recentErr) throw recentErr;
      if ((recentSameDevice ?? []).length >= 2) {
        score += 40;
        reasons.push("multi_account_burst_same_device");
      }
    }

    const allowed = score < DENY_SCORE;
    const verdict: FraudVerdict = {
      allowed,
      score,
      reasons,
      message: allowed
        ? undefined
        : buildDenyMessage(input.action, reasons, input.userId, score),

      ...base,
    };
    await logAssessment(input.userId, input.action, verdict);
    return verdict;
  } catch (err) {
    console.error("[fraud-engine] falha crítica:", err);
    return {
      allowed: false,
      score: 0,
      reasons: ["engine_error"],
      message:
        "A validação de segurança está temporariamente indisponível. Tente novamente em alguns minutos.",
      deviceHash: sig.deviceHash,
      attrsHash: sig.attrsHash,
      ipHash: sig.ipHash,
      ipPrefixHash: sig.ipPrefixHash,
    };
  }
}
