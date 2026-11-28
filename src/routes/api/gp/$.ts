import { createFileRoute } from '@tanstack/react-router';

/**
 * Proxy reverso do painel da Gangstar.
 *
 * Objetivo: deixar o painel (HTTP, IP cru) acessível por HTTPS, no nosso
 * domínio, dentro de um iframe — resolvendo "mixed content" e escondendo a URL.
 *
 * TRAVADO no host do painel (nunca proxia outro destino) pra não virar um proxy
 * aberto. É uma tentativa best-effort: painéis SPA podem usar URLs absolutas ou
 * caminhos a partir da raiz que o proxy não consegue reescrever 100% — se algo
 * quebrar (assets/login/websocket), o caminho robusto é servir o painel por
 * HTTPS de verdade (domínio + TLS) e aí o iframe funciona direto.
 */

// Origem do painel. Mantida fixa aqui (ou via env) — jamais vinda do request.
const PANEL_ORIGIN = (process.env['GANGSTAR_PANEL_ORIGIN'] || 'http://179.0.177.133:6900').replace(/\/+$/, '');
const PREFIX = '/api/gp';

// Cabeçalhos que não devem ser repassados do cliente pro painel.
const STRIP_REQ = new Set(['host', 'connection', 'content-length', 'accept-encoding']);
// Cabeçalhos de resposta que bloqueiam embed / forçam https e precisam cair.
const STRIP_RES = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'content-encoding',
  'content-length',
  'strict-transport-security',
]);

function isTextual(contentType: string | null): boolean {
  if (!contentType) return false;
  return /text\/|application\/(javascript|json|xml|xhtml|manifest)|\+json|\+xml|image\/svg/i.test(contentType);
}

/** Reescreve referências absolutas ao painel e caminhos de raiz pro prefixo do proxy. */
function rewriteBody(body: string, contentType: string | null, proxyBase: string): string {
  // 1) Qualquer URL absoluta pro painel vira o nosso proxy.
  let out = body.split(PANEL_ORIGIN).join(proxyBase);
  // websocket absoluto -> wss no nosso proxy (best-effort; pode não bastar).
  out = out.replace(/ws:\/\/179\.0\.177\.133:6900/g, `wss://${new URL(proxyBase).host}${PREFIX}`);

  // 2) Só no HTML: injeta <base> pra caminhos relativos resolverem sob o prefixo.
  if (contentType && /text\/html/i.test(contentType)) {
    if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, `<head$1><base href="${PREFIX}/">`);
    }
    // Caminhos a partir da raiz nos atributos mais comuns do HTML inicial.
    out = out.replace(/(\s(?:href|src|action)=["'])\/(?!\/)/gi, `$1${PREFIX}/`);
  }
  return out;
}

async function proxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const proxyBase = `${url.origin}${PREFIX}`;
  // Caminho do painel = tudo depois de /api/gp
  const rest = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) : url.pathname;
  const target = `${PANEL_ORIGIN}${rest || '/'}${url.search}`;

  // Monta os headers de ida (sem os proibidos).
  const fwd = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIP_REQ.has(key.toLowerCase())) fwd.set(key, value);
  });
  fwd.set('accept-encoding', 'identity');

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: fwd,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
    });
  } catch (e: any) {
    return new Response(
      `Não foi possível alcançar o painel da Gangstar.\n\n${e?.message ?? 'erro de conexão'}`,
      { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }

  // Headers de volta (sem os que bloqueiam embed).
  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (STRIP_RES.has(k)) return;
    if (k === 'set-cookie') return; // tratado abaixo (precisa tirar o Domain)
    if (k === 'location') {
      // Reescreve redirecionamentos pro nosso proxy.
      resHeaders.set(key, value.startsWith(PANEL_ORIGIN) ? value.replace(PANEL_ORIGIN, proxyBase) : value.startsWith('/') ? `${PREFIX}${value}` : value);
      return;
    }
    resHeaders.set(key, value);
  });

  // Cookies: remove Domain (atrelado ao IP do painel) pra valer no nosso host,
  // e tira Secure se vier (a origem é HTTP). Assim o login do painel persiste.
  const cookies: string[] = (upstream.headers as any).getSetCookie?.() ?? [];
  for (const c of cookies) {
    const fixed = c.replace(/;\s*Domain=[^;]*/gi, '').replace(/;\s*Secure/gi, '');
    resHeaders.append('set-cookie', fixed);
  }
  // Garante que PODE ser embutido no nosso domínio.
  resHeaders.set('content-security-policy', `frame-ancestors 'self'`);

  const contentType = upstream.headers.get('content-type');
  if (isTextual(contentType)) {
    const text = await upstream.text();
    const rewritten = rewriteBody(text, contentType, proxyBase);
    return new Response(rewritten, { status: upstream.status, headers: resHeaders });
  }

  // Binário (imagens, fontes): repassa como veio.
  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}

export const Route = createFileRoute('/api/gp/$')({
  server: {
    handlers: {
      GET: ({ request }) => proxy(request),
      POST: ({ request }) => proxy(request),
      PUT: ({ request }) => proxy(request),
      PATCH: ({ request }) => proxy(request),
      DELETE: ({ request }) => proxy(request),
      OPTIONS: ({ request }) => proxy(request),
      HEAD: ({ request }) => proxy(request),
    },
  },
});
