/**
 * Canonical public URL of the site.
 *
 * Set VITE_SITE_URL (ex.: https://www.shadowstore.com) no ambiente de produção
 * para que os links de confirmação de e-mail e o retorno do OAuth apontem
 * sempre para o domínio oficial, mesmo quando o app é aberto por uma URL
 * alternativa (deploy preview da Vercel, etc.).
 *
 * Sem a variável definida, cai no origin atual (dev/preview).
 */
export function siteUrl(path = ""): string {
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  const base =
    configured && configured.length > 0
      ? configured.replace(/\/+$/, "")
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
