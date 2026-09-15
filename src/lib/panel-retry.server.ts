/**
 * Reexecução automática de chamadas ao painel externo (Yaarsa).
 *
 * O painel devolve falhas passageiras com frequência (timeout, conexão
 * recusada, 502/504, "server busy"). Antes, uma única falha dessas já fazia o
 * botão do cliente ("Pausar login", "Reparar acesso") dizer que não deu certo.
 * Aqui repetimos a mesma chamada algumas vezes com espera crescente e só
 * desistimos quando o erro é definitivo (conta inexistente, quota, etc).
 */

const TRANSIENT_RE =
  /timeout|timed out|abort|econn|socket|network|fetch failed|temporar|indispon|unavailable|502|503|504|429|busy|gateway|reset|refus/i;

export function isTransientPanelFail(fail?: string | null): boolean {
  if (!fail) return false;
  return TRANSIENT_RE.test(String(fail));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Executa `fn` até 3 vezes enquanto o painel devolver falha passageira.
 * Exceções de rede lançadas pelo fetch também entram no retry.
 */
export async function retryPanelCall<T extends { Fail?: string | null }>(
  fn: () => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number; label?: string },
): Promise<T> {
  const attempts = opts?.attempts ?? 3;
  const base = opts?.baseDelayMs ?? 700;
  let last: T | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fn();
      if (!res?.Fail) return res;
      last = res;
      if (!isTransientPanelFail(res.Fail)) return res;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (!isTransientPanelFail(msg) && i === attempts - 1) throw e;
      last = { Fail: msg } as T;
      if (!isTransientPanelFail(msg)) throw e;
    }
    if (i < attempts - 1) {
      if (opts?.label) {
        console.warn(`[panel-retry] ${opts.label}: tentativa ${i + 1} falhou (${last?.Fail}), repetindo…`);
      }
      await sleep(base * (i + 1));
    }
  }
  return (last ?? ({ Fail: "Falha desconhecida no painel" } as T)) as T;
}
