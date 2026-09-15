// Regras client-safe para os links externos de atualização.
// Objetivo: tirar o download pesado do nosso armazenamento (que consome a cota
// mensal de tráfego) e mandar o cliente direto para a origem do arquivo.

export const EXTERNAL_URL_HELP =
  "Cole um link https direto do arquivo (Google Drive, Mega, Cloudflare R2, MediaFire…).";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isPrivateHost(host: string) {
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  // Faixas privadas: 10.x, 192.168.x, 172.16–31.x
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

/**
 * Converte o link de compartilhamento do Google Drive no link de download
 * direto, para o cliente não cair na tela de pré-visualização.
 */
export function normalizeExternalUrl(raw: string): string {
  const value = raw.trim();
  if (!value) throw new Error("Informe o link do arquivo.");
  if (value.length > 2000) throw new Error("Link longo demais.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Link inválido. " + EXTERNAL_URL_HELP);
  }

  if (url.protocol !== "https:") throw new Error("O link precisa começar com https://");
  if (isPrivateHost(url.hostname)) throw new Error("Esse endereço não é acessível pelos clientes.");

  const driveId =
    url.hostname.endsWith("drive.google.com")
      ? url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get("id")
      : null;
  if (driveId) return `https://drive.google.com/uc?export=download&id=${driveId}`;

  return url.toString();
}

export function externalHostLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
