/**
 * Aplicação dos códigos de resgate (cortesias da equipe).
 *
 * Dois tipos:
 *  - `license_days`     → dias de licença (estende a licença escolhida ou cria uma nova).
 *  - `server_renewal`   → adianta a mensalidade do servidor da licença escolhida
 *                         para o próximo dia 20 e destrava o acesso na hora.
 *
 * Fica fora dos arquivos de server function porque o bundler apaga código
 * irmão de `createServerFn`.
 */

import { extendedExpiry } from "./redeem-rules";

export type RedeemOutcome = {
  licenseId: string;
  kind: string;
  expires_at: string | null;
  created: boolean;
  message: string;
  credentials?: { username: string; email: string; password: string; server_ip: string | null };
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Adianta o servidor da licença até o próximo dia 20, respeitando o painel. */
export async function applyServerRenewalCode(license: any): Promise<RedeemOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { yaarsaExtend, yaarsaReadAccount } = await import("./yaarsa.server");
  const { planServerRenewal, reconcilePanelExpiry } = await import("./server-renewal");
  const { nextDay20 } = await import("./admin-shared");

  const paidUntil = nextDay20();
  const plan = planServerRenewal(license, paidUntil);

  let panelDate: string | null = null;
  try {
    const acc = await yaarsaReadAccount(license.yaarsa_email, license.panel ?? "v457");
    panelDate = acc.known ? acc.expireDate : null;
  } catch {
    /* best-effort */
  }

  const rec = reconcilePanelExpiry(plan.panelExpireDate, panelDate, plan.patch.expires_at);
  if (rec.shouldPush) {
    const r = await yaarsaExtend(license.yaarsa_email, rec.effectivePanelDate, license.panel ?? "v457");
    if (r.Fail && !/1005|not found|não encontrado/i.test(r.Fail)) {
      throw new Error("O painel de licenças não aceitou a renovação agora. Tente novamente em alguns minutos.");
    }
  }

  const { error } = await supabaseAdmin
    .from("licenses")
    .update({ ...plan.patch, expires_at: rec.dbExpiresAt } as any)
    .eq("id", license.id);
  if (error) throw new Error("Não foi possível salvar a renovação. Fale com o suporte.");

  return {
    licenseId: license.id,
    kind: "server_renewal",
    expires_at: rec.dbExpiresAt,
    created: false,
    message: `Servidor liberado até ${paidUntil.toLocaleDateString("pt-BR")}. Seu login já pode ser usado no BTmob.`,
  };
}

/** Soma dias de cortesia numa licença existente. */
export async function applyDaysToLicense(license: any, days: number): Promise<RedeemOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { yaarsaExtend } = await import("./yaarsa.server");

  if (license.expires_at === null) {
    throw new Error("Esta licença é vitalícia — escolha outra licença para aplicar os dias.");
  }
  const next = extendedExpiry(license.expires_at, days);
  const r = await yaarsaExtend(license.yaarsa_email, ymd(next), license.panel ?? "v457");
  if (r.Fail && !/1005|not found|não encontrado/i.test(r.Fail)) {
    throw new Error("O painel de licenças não aceitou a extensão agora. Tente novamente em alguns minutos.");
  }

  const { error } = await supabaseAdmin
    .from("licenses")
    .update({
      expires_at: next.toISOString(),
      revoked: false,
      server_overdue_at: null,
      ...(license.suspended_at ? {} : { status: "active" }),
    } as any)
    .eq("id", license.id);
  if (error) throw new Error("Não foi possível salvar os dias. Fale com o suporte.");

  return {
    licenseId: license.id,
    kind: "license_days",
    expires_at: next.toISOString(),
    created: false,
    message: `+${days} dia${days === 1 ? "" : "s"} aplicados. Válido até ${next.toLocaleDateString("pt-BR")}.`,
  };
}

/** Cria uma licença nova de cortesia quando o cliente ainda não tem nenhuma. */
export async function createCourtesyLicense(
  userId: string,
  days: number,
  planSlug: string,
): Promise<RedeemOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const {
    yaarsaCreateAccount, yaarsaExtend, generateCredentials, encrypt,
    resolvePanelFromPlanSlug, resolvePanelServerHost,
  } = await import("./yaarsa.server");
  const { tierFromPlanSlug } = await import("./plans");

  const creds = generateCredentials();
  const panel = await resolvePanelFromPlanSlug(planSlug);
  const expiresAt = extendedExpiry(null, days);

  const yr = await yaarsaCreateAccount({
    username: creds.username,
    email: creds.email,
    password: creds.password,
    planSlug,
    totalPaid: 0,
    additionalInfo: `shadow-redeem-${userId.slice(0, 8)}`,
    panel,
  });
  if (yr.Fail && !/1004|already|exist/i.test(yr.Fail)) {
    throw new Error("O painel de licenças não respondeu agora. Tente resgatar novamente em alguns minutos.");
  }
  await yaarsaExtend(creds.email, ymd(expiresAt), panel);
  const serverIp = await resolvePanelServerHost(panel);

  const { data: lic, error } = await supabaseAdmin
    .from("licenses")
    .insert({
      user_id: userId,
      plan_slug: planSlug,
      yaarsa_username: creds.username,
      yaarsa_email: creds.email,
      yaarsa_password_enc: encrypt(creds.password),
      expires_at: expiresAt.toISOString(),
      is_trial: false,
      status: "active",
      origin_type: "redeem_code",
      version_tier: tierFromPlanSlug(planSlug),
      panel,
      server_ip: serverIp,
    } as any)
    .select("*")
    .single();
  if (error || !lic) throw new Error("Licença criada no painel, mas falhou ao salvar aqui. Fale com o suporte.");

  return {
    licenseId: lic.id,
    kind: "license_days",
    expires_at: expiresAt.toISOString(),
    created: true,
    message: `Licença de ${days} dia${days === 1 ? "" : "s"} liberada! Suas credenciais já aparecem no painel.`,
    credentials: {
      username: creds.username,
      email: creds.email,
      password: creds.password,
      server_ip: serverIp ?? null,
    },
  };
}
