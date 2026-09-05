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
    try {
      const r: any = await run(panel);
      const fail = r?.Fail ? String(r.Fail) : "";
      if (!fail) return { status: "done", panel, error: null, tried };
      if (NOT_FOUND_RE.test(fail)) {
        sawMissing = true;
        continue; // conta não está neste painel: tenta o próximo
      }
      lastError = fail;
    } catch (e: any) {
      lastError = e?.message || "yaarsa_exception";
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

export function yesterdayYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
