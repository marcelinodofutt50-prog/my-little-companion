/**
 * Rotinas compartilhadas dos crons de licença.
 *
 * Problema corrigido aqui: os hooks antigos mapeavam o painel como
 * `v46 : v457`, ignorando completamente o painel v455 (semanal). Uma licença
 * criada no v455 nunca era removida/suspensa de verdade — o painel respondia
 * "conta não encontrada" e o cliente continuava logando depois do vencimento.
 *
 * Agora tentamos o painel gravado na licença e, se a conta não estiver lá,
 * varremos os demais painéis antes de desistir. Também distinguimos três
 * desfechos, para nunca "fingir" sucesso:
 *   - done    : conta removida/suspensa de verdade
 *   - missing : conta não existe em painel nenhum (nada a fazer)
 *   - failed  : painel fora do ar / erro — precisa reprocessar depois
 */
import {
  ALL_PANELS,
  hasPanelServer,
  refreshPanelOverrides,
  yaarsaExtend,
  yaarsaRemoveAccount,
  type YaarsaPanel,
} from "./yaarsa.server";

export type PanelOutcome = {
  status: "done" | "missing" | "failed";
  panel: YaarsaPanel | null;
  error: string | null;
  tried: string[];
};

const NOT_FOUND_RE = /1005|not.?found|cant.?find|inexist|não\s*encontrad|nao\s*encontrad/i;

export function normalizePanel(p: string | null | undefined): YaarsaPanel {
  return p === "v46" ? "v46" : p === "v455" ? "v455" : "v457";
}

/** Painel gravado primeiro, depois os demais que estão configurados. */
export function panelOrder(preferred: string | null | undefined): YaarsaPanel[] {
  const first = normalizePanel(preferred);
  const rest = ALL_PANELS.filter((p) => p !== first);
  return [first, ...rest].filter((p) => hasPanelServer(p));
}

/** Erros passageiros (painel engasgado) merecem uma segunda tentativa. */
const TRANSIENT_RE = /timeout|timed?.?out|econn|network|fetch failed|502|503|504|temporar|php|internal/i;

async function sweep(
  email: string,
  preferred: string | null | undefined,
  run: (panel: YaarsaPanel) => Promise<{ Fail?: string } | any>,
): Promise<PanelOutcome> {
  await refreshPanelOverrides();
  const order = panelOrder(preferred);
  const tried: string[] = [];
  let lastError: string | null = null;
  let sawMissing = false;

  for (const panel of order) {
    tried.push(panel);
    for (let attempt = 0; attempt < 2; attempt++) {
      let fail = "";
      try {
        const r: any = await run(panel);
        fail = r?.Fail ? String(r.Fail) : "";
        if (!fail) return { status: "done", panel, error: null, tried };
      } catch (e: any) {
        fail = e?.message || "yaarsa_exception";
      }
      if (NOT_FOUND_RE.test(fail)) {
        sawMissing = true;
        break; // conta não está neste painel: tenta o próximo
      }
      lastError = fail;
      if (attempt === 0 && TRANSIENT_RE.test(fail)) continue; // repete uma vez
      break;
    }
  }

  if (lastError) return { status: "failed", panel: null, error: lastError, tried };
  if (sawMissing) return { status: "missing", panel: null, error: null, tried };
  return { status: "failed", panel: null, error: "nenhum painel configurado", tried };
}

/** Apaga a conta do cliente em qualquer painel onde ela exista. */
export function removeAccountAnyPanel(email: string, preferred: string | null | undefined) {
  return sweep(email, preferred, (panel) => yaarsaRemoveAccount(email, panel));
}

/** Suspende (expira para ontem) a conta em qualquer painel onde ela exista. */
export function suspendAccountAnyPanel(
  email: string,
  preferred: string | null | undefined,
  ymd: string,
) {
  return sweep(email, preferred, (panel) => yaarsaExtend(email, ymd, panel));
}

/**
 * Alinha a validade da conta no painel com a validade salva no site.
 * O painel corta o login à meia-noite, então gravamos +1 dia de folga.
 */
export function setExpiryAnyPanel(
  email: string,
  preferred: string | null | undefined,
  expiresAt: string | Date,
) {
  const d = new Date(expiresAt);
  d.setDate(d.getDate() + 1);
  const ymd = d.toISOString().slice(0, 10);
  return sweep(email, preferred, (panel) => yaarsaExtend(email, ymd, panel));
}

export function yesterdayYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Brecha corrigida: o cliente que renova comprando uma licença NOVA costuma
 * reaproveitar o mesmo login do painel. O cron removia/suspendia a conta por
 * causa da licença antiga vencida e derrubava a licença nova, que estava paga.
 * Antes de mexer no painel, confirmamos que nenhuma outra licença ativa usa
 * o mesmo e-mail.
 */
export async function hasOtherActiveLicense(
  admin: any,
  email: string | null | undefined,
  excludeId: string,
): Promise<boolean> {
  if (!email) return false;
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("licenses")
    .select("id, expires_at")
    .ilike("yaarsa_email", email.trim())
    .neq("id", excludeId)
    .is("disabled_at", null)
    .eq("revoked", false)
    .limit(5);
  // Na dúvida (erro de leitura), NÃO mexe no painel: melhor adiar do que
  // derrubar um cliente pagante.
  if (error) return true;
  return (data ?? []).some((r: any) => !r.expires_at || r.expires_at > nowIso);
}

/** IDs de licenças cuja remoção no painel já foi concluída (não reprocessar). */
export async function alreadyCleanedIds(admin: any, ids: string[], sinceIso: string): Promise<Set<string>> {
  const done = new Set<string>();
  if (!ids.length) return done;
  const { data } = await admin
    .from("integration_logs")
    .select("context, outcome")
    .eq("source", "auto-expire")
    .in("outcome", ["removed", "already_absent", "skipped_shared_login"])
    .gte("created_at", sinceIso)
    .limit(1000);
  for (const r of data ?? []) {
    const id = r?.context?.license_id;
    if (id && ids.includes(id)) done.add(id);
  }
  return done;
}
