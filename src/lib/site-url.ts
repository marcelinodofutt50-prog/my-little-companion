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

/**
 * Detecta se o navegador está numa URL de callback de confirmação de e-mail
 * do Supabase que aponta para localhost (caso o Site URL ainda não tenha
 * sido atualizado no Supabase). Retorna a URL equivalente no domínio oficial.
 */
export function redirectLocalhostAuthToCanonical(): string | null {
  if (typeof window === "undefined") return null;
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (!configured || configured.length === 0) return null;

  const url = new URL(window.location.href);
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!isLocalhost) return null;

  const hasAuthParams = url.searchParams.has("code") && url.searchParams.has("type");
  if (!hasAuthParams) return null;

  const canonical = new URL(configured.replace(/\/+$/, ""));
  canonical.pathname = url.pathname;
  canonical.search = url.search;
  canonical.hash = url.hash;
  return canonical.toString();
}
