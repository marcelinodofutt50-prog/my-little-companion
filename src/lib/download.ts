/**
 * Download helper resiliente.
 *
 * Safari/iOS costuma abortar `fetch`/blob de arquivos grandes com o erro
 * genérico "Load failed". Por isso navegamos direto para a URL assinada
 * (que já vem com Content-Disposition: attachment) em vez de baixar o
 * arquivo em memória.
 */

export function triggerDownload(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  if (filename) a.download = filename;
  // Safari só respeita o clique se o elemento estiver no DOM
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
}

/** Executa uma promise com tentativas extras (falhas de rede transitórias). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 800): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

/** Converte erros técnicos em mensagens claras em PT-BR. */
export function friendlyDownloadError(e: unknown): string {
  const msg = (e as any)?.message ? String((e as any).message) : String(e ?? "");
  if (/load failed|failed to fetch|networkerror|network request failed/i.test(msg)) {
    return "Conexão instável ao iniciar o download. Verifique sua internet (ou desative VPN/bloqueador) e tente novamente.";
  }
  if (/não encontrado|not found/i.test(msg)) return "Arquivo não encontrado. O link pode ter expirado — recarregue a página.";
  if (/ainda não disponível/i.test(msg)) return "O APK ainda está sendo processado. Aguarde a fila terminar.";
  if (/unauthorized|401|forbidden|403/i.test(msg)) return "Sessão expirada. Faça login novamente para baixar.";
  return msg || "Falha ao gerar o download. Tente novamente em instantes.";
}
