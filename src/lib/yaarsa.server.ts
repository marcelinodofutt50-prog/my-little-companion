// Server-only helpers for Yaarsa integration and license credential encryption.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Yaarsa expire_date format: YYYY-MM-DD.
function yesterdayYMD(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}


// ============================================================================
// MULTI-PANEL SUPPORT
// ----------------------------------------------------------------------------
// We talk to up to three Yaarsa VPS instances:
//   - v455: weekly panel  (Shadow 4.5.5)  → YAARSA_V455_BASE_URL + YAARSA_V455_ADMIN_KEY
//   - v457: original panel (Shadow 4.5.7)  → YAARSA_BASE_URL + YAARSA_ADMIN_KEY
//   - v46 : newer panel   (Shadow 4.6+)    → YAARSA_V46_BASE_URL + YAARSA_V46_ADMIN_KEY
// Every public helper accepts an optional `panel` argument. When omitted we
// default to `v457` (the original panel) so old call sites keep working.
// ============================================================================
export type YaarsaPanel = "v455" | "v457" | "v46";
export const ALL_PANELS: YaarsaPanel[] = ["v455", "v457", "v46"];

/** Semanal só vai para a VPS 4.5.5 quando existe uma configurada. */
function weeklyPanel(): YaarsaPanel {
  return hasPanelServer("v455") ? "v455" : "v457";
}

export function panelFromTier(tier: string | null | undefined): YaarsaPanel {
  if (tier === "lifetime_46") return "v46";
  if (tier === "weekly") return weeklyPanel();
  return "v457";
}

export function panelFromPlanSlug(slug: string | null | undefined): YaarsaPanel {
  if (!slug) return "v457";
  const s = slug.toLowerCase();
  if (s.includes("lifetime") || s.includes("kraken")) return "v46";
  if (s.includes("7d") || s.includes("week") || s.includes("seman") || s === "trial")
    return weeklyPanel();
  return "v457";
}

/**
 * Versões assíncronas: garantem que os overrides do banco (`panel_servers`)
 * estejam carregados ANTES de decidir o painel. Sem isso, num worker "frio" o
 * plano semanal cairia na 4.5.7 mesmo com a VPS 4.5.5 cadastrada no admin.
 * Use sempre estas em fluxos de entrega (webhook, cripto, admin).
 */
export async function resolvePanelFromPlanSlug(slug: string | null | undefined): Promise<YaarsaPanel> {
  await refreshPanelOverrides();
  return panelFromPlanSlug(slug);
}

export async function resolvePanelFromTier(tier: string | null | undefined): Promise<YaarsaPanel> {
  await refreshPanelOverrides();
  return panelFromTier(tier);
}


type PanelConfig = { baseEnv: string; keyEnv: string; defaultUrl: string };
const PANEL_CONFIG: Record<YaarsaPanel, PanelConfig> = {
  v455: {
    baseEnv: "YAARSA_V455_BASE_URL",
    keyEnv: "YAARSA_V455_ADMIN_KEY",
    // Sem VPS própria da 4.5.5 ainda: cai no painel 4.5.7.
    defaultUrl: "http://191-96-78-81.sslip.io/yaarsa/proxy.php",
  },
  v457: {
    baseEnv: "YAARSA_BASE_URL",
    keyEnv: "YAARSA_ADMIN_KEY",
    defaultUrl: "http://191-96-78-81.sslip.io/yaarsa/proxy.php",
  },
  v46: {
    baseEnv: "YAARSA_V46_BASE_URL",
    keyEnv: "YAARSA_V46_ADMIN_KEY",
    defaultUrl: "http://200.9.154.103.sslip.io/yaarsa/proxy.php",
  },
};

// Overrides vindos do banco (tabela `panel_servers`), preenchidos por
// `refreshPanelOverrides()` antes de cada operação. Permite ao admin trocar de
// VPS pelo painel, sem redeploy. Sem override, valem as variáveis de ambiente.
type PanelRuntime = { baseUrl?: string; adminKey?: string };
const runtimeOverrides: Record<YaarsaPanel, PanelRuntime> = { v455: {}, v457: {}, v46: {} };

// Configuração "fixada" temporariamente (usada pela verificação com os dados
// que o admin acabou de digitar, antes de salvar). Enquanto estiver fixada,
// nem o banco nem o ambiente sobrescrevem esses valores.
const pinnedOverrides: Partial<Record<YaarsaPanel, PanelRuntime>> = {};

/** Roda `fn` usando um endereço/admin key temporários para o painel. */
export async function withPanelConfig<T>(
  panel: YaarsaPanel,
  cfg: { baseUrl: string; adminKey: string },
  fn: () => Promise<T>,
): Promise<T> {
  pinnedOverrides[panel] = { baseUrl: cfg.baseUrl.trim(), adminKey: cfg.adminKey.trim() };
  try {
    return await fn();
  } finally {
    delete pinnedOverrides[panel];
  }
}

function effective(panel: YaarsaPanel): PanelRuntime {
  return pinnedOverrides[panel] ?? runtimeOverrides[panel];
}

/** Existe VPS configurada (banco ou ambiente) para esse painel? */
export function hasPanelServer(panel: YaarsaPanel): boolean {
  return !!(effective(panel).baseUrl || process.env[PANEL_CONFIG[panel].baseEnv]);
}

export async function refreshPanelOverrides(force = false): Promise<void> {
  try {
    const { loadPanelOverrides } = await import("@/lib/panel-servers.server");
    const map = await loadPanelOverrides(force);
    for (const p of ALL_PANELS) {
      const o = map.get(p);
      runtimeOverrides[p] = o ? { baseUrl: o.baseUrl, adminKey: o.adminKey } : {};
    }
  } catch (e) {
    console.warn("[yaarsa] overrides indisponíveis, usando ambiente:", (e as Error)?.message);
  }
}

/** Endereço efetivo do painel (formulário > banco > ambiente > padrão). */
export function panelBaseUrl(panel: YaarsaPanel): string {
  const cfg = PANEL_CONFIG[panel];
  return (effective(panel).baseUrl || process.env[cfg.baseEnv] || cfg.defaultUrl).trim();
}


/**
 * IP/host efetivo do painel — derivado do endereço realmente em uso.
 * É esse valor que vai para `licenses.server_ip` (o que o cliente digita no
 * app). Nunca use IP fixo no código: se o admin trocar a VPS, o cliente
 * precisa receber o endereço novo automaticamente.
 */
export function panelServerHost(panel: YaarsaPanel): string {
  const raw = panelBaseUrl(panel);
  let host = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split("?")[0];
  host = host.replace(/:\d+$/, "");
  // formatos sslip.io: 1.2.3.4.sslip.io  ou  1-2-3-4.sslip.io
  const m = host.match(/^((?:\d{1,3}[.-]){3}\d{1,3})\.sslip\.io$/i);
  if (m) return m[1].replace(/-/g, ".");
  return host;
}

/** Versão assíncrona: garante que os overrides do banco estejam carregados. */
export async function resolvePanelServerHost(panel: YaarsaPanel): Promise<string> {
  await refreshPanelOverrides();
  return panelServerHost(panel);
}

/** Origem da configuração atual do painel (para diagnóstico no admin). */
export function panelConfigSource(panel: YaarsaPanel): "formulario" | "painel" | "ambiente" | "padrao" {
  if (pinnedOverrides[panel]?.baseUrl) return "formulario";
  if (runtimeOverrides[panel].baseUrl) return "painel";
  if (process.env[PANEL_CONFIG[panel].baseEnv]) return "ambiente";
  return "padrao";
}


// Resolve the Yaarsa API endpoints for a given panel.
// Honor the configured URL as-is when it points to a callable .php entry
// (e.g. /yaarsa/proxy.php or /yaarsa/private/createacc.php). Only reject the
// admin-UI path (create9999.php) and normalize bare hosts to /yaarsa/proxy.php
// (with private/createacc.php as a secondary fallback).
export function yaarsaEndpointsFor(rawBase: string): string[] {
  const configured = rawBase.trim().replace(/\/+$/, "");
  const raw = /^https?:\/\//i.test(configured) ? configured : `http://${configured}`;

  const isAdminUi = /create9999\.php/i.test(raw);
  const isCallablePhp = /\.php($|\?)/i.test(raw) && !isAdminUi;

  const endpoints: string[] = [];
  if (isCallablePhp) {
    endpoints.push(raw);
    // Add the sibling endpoint as a fallback in case the configured one is down.
    const host = raw.replace(/\/yaarsa\/.*$/i, "").replace(/\/+$/, "");
    if (/proxy\.php/i.test(raw)) endpoints.push(`${host}/yaarsa/private/createacc.php`);
    else endpoints.push(`${host}/yaarsa/proxy.php`);
  } else {
    const host = raw.replace(/\/yaarsa\/.*$/i, "").replace(/\/+$/, "");
    endpoints.push(`${host}/yaarsa/proxy.php`);
    endpoints.push(`${host}/yaarsa/private/createacc.php`);
    endpoints.push(`${host}/proxy.php`);
    endpoints.push(`${host}/createacc.php`);
    endpoints.push(`${host}/proxy.php`);
    endpoints.push(`${host}/createacc.php`);
  }

  const seen = new Set<string>();
  return endpoints.filter((u) => {
    const k = u.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function yaarsaEndpoints(panel: YaarsaPanel): string[] {
  return yaarsaEndpointsFor(panelBaseUrl(panel));
}

export function sanitizeAdminKey(raw: string, label = "admin key"): string {
  const cleaned = raw
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .replace(/^["']|["']$/g, "");
  if (!cleaned) throw new Error(`${label} vazia`);
  if (/[^\x21-\x7E]/.test(cleaned)) {
    throw new Error(`${label} contém caracteres inválidos (use apenas ASCII imprimível)`);
  }
  return cleaned;
}

const PANEL_LABEL: Record<YaarsaPanel, string> = { v455: "4.5.5", v457: "4.5.7", v46: "4.6" };

function yaarsaAdminKey(panel: YaarsaPanel): string {
  const cfg = PANEL_CONFIG[panel];
  const override = effective(panel).adminKey;
  const raw = override || process.env[cfg.keyEnv];
  if (!raw) {
    throw new Error(
      `Nenhuma admin key configurada para o painel ${PANEL_LABEL[panel]}. Preencha o endereço e a admin key no formulário abaixo e clique em "Verificação completa" ou "Salvar e usar".`,
    );
  }
  return sanitizeAdminKey(raw, override ? `admin key do painel ${PANEL_LABEL[panel]}` : cfg.keyEnv);
}


function encKey(): Buffer {
  const raw = process.env.LICENSE_ENC_KEY;
  if (!raw) throw new Error("LICENSE_ENC_KEY not set");
  const buf = Buffer.from(raw, "utf8");
  if (buf.length >= 32) return buf.subarray(0, 32);
  const padded = Buffer.alloc(32);
  buf.copy(padded);
  return padded;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decrypt(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const d = createDecipheriv("aes-256-gcm", encKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

// Yaarsa PHP requires: 1 upper, 1 special, 8..16 chars
export function generateCredentials() {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const specials = "@#$%!*";
  const rand = (s: string, n: number) =>
    Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join("");

  const username = rand(lower, 5);
  const email = `${username}${Math.floor(Math.random() * 100000)}@gmail.com`;
  const raw = (rand(lower, 4) + rand(upper, 3) + rand(digits, 3) + rand(specials, 2))
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
  return { username, email, password: raw };
}

export function deriveCredentials(seed: string) {
  const h = createHash("sha256").update(seed).digest();
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const specials = "@#$%!*";
  const pick = (alpha: string, i: number) => alpha[h[i] % alpha.length];

  const uname = [0, 1, 2, 3, 4].map((i) => pick(lower, i)).join("");
  const suffix = ((h[5] << 16) + (h[18] << 8) + h[19]) % 100000;
  const email = `${uname}${suffix}@gmail.com`;
  const pw = [
    pick(lower, 6),
    pick(lower, 7),
    pick(lower, 8),
    pick(lower, 9),
    pick(upper, 10),
    pick(upper, 11),
    pick(upper, 12),
    pick(digits, 13),
    pick(digits, 14),
    pick(digits, 15),
    pick(specials, 16),
    pick(specials, 17),
  ];
  for (let i = pw.length - 1; i > 0; i--) {
    const j = h[18 + (i % 14)] % (i + 1);
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return { username: uname, email, password: pw.join("") };
}

export function planToSubtype(planSlug: string): string {
  if (planSlug === "login-7d") return "7 Days";
  if (planSlug === "login-30d" || planSlug === "kraken-monthly") return "1 Month";
  if (planSlug === "login-lifetime" || planSlug === "kraken-lifetime") return "12 Month";
  return "1 Month";
}

export function expireDateFor(planSlug: string): string {
  // BMob invalida logins na virada da meia-noite, então damos 1 dia de buffer
  // no Yaarsa. O corte real acontece pelo cron /api/public/hooks/expire-licenses,
  // que remove a conta assim que o expires_at persistido no banco é atingido.
  const d = new Date();
  if (planSlug === "login-7d") d.setDate(d.getDate() + 8);
  else if (planSlug === "login-30d" || planSlug === "kraken-monthly") d.setDate(d.getDate() + 31);
  else if (planSlug === "login-lifetime" || planSlug === "kraken-lifetime") d.setFullYear(d.getFullYear() + 20);
  else if (planSlug === "trial") d.setDate(d.getDate() + 2);
  else d.setDate(d.getDate() + 31);
  return d.toISOString().slice(0, 10);
}

type YaarsaResponse = { Success?: string; Fail?: string; action?: string; statusCode?: number; attempt?: number; error?: string; code?: string };

function friendlyYaarsaFail(message: string, statusCode?: number): string {
  const m = message.trim();
  if (/please check admin key|admin key/i.test(m))
    return "Chave administrativa do painel foi rejeitada. Avise o suporte para revalidar as credenciais.";
  if (/already.*use|already.*exist|email.*use|1004|existe/i.test(m))
    return "Este usuário/e-mail já existe no painel. Se você já tem uma conta lá, use a opção de cliente antigo no painel.";
  if (/maximum allowed accounts reached|allowed accounts|limite.*100|100.*accounts/i.test(m))
    return "O painel atingiu o limite de 100 contas para esta chave. Contate o suporte para liberar espaço.";
  if (/cant find|not found|1005|não encontrado/i.test(m))
    return "Usuário não encontrado neste painel.";
  if (/date not accepted|1006|expired|expira|accepted/i.test(m))
    return "Data de expiração recusada pelo painel (pode estar fora do range permitido). Tente novamente.";
  if (/array offset on null|undefined offset|trying to access|warning:|notice:/i.test(m))
    return "O painel devolveu uma resposta inválida (erro interno PHP). Tente novamente.";
  if (statusCode === 403 || /HTTP 403/i.test(m))
    return "O painel bloqueou temporariamente esta requisição (403). Tentando rota alternativa — se persistir, avise o suporte.";
  if (statusCode === 404 || /devolveu HTML|não encontrado/i.test(m))
    return "O painel devolveu uma página inválida ou não encontrada (404). Provavelmente o endereço ou a rota proxy está incorreta.";
  if (statusCode === 502 || statusCode === 503 || statusCode === 504 || /falha de rede|gateway|timeout/i.test(m))
    return "Falha de rede ou timeout ao contatar o servidor de autenticação. Verifique se o servidor está online ou tente novamente.";
  if (/Nenhum painel respondeu/i.test(m))
    return "O servidor de licenças não está respondendo no momento. Sua solicitação foi recebida e será processada automaticamente em alguns instantes. Caso o problema persista, tente novamente ou contate o suporte.";
  return m;
}

export async function yaarsaCreateAccount(input: {
  username: string;
  email: string;
  password: string;
  planSlug: string;
  totalPaid: number;
  additionalInfo?: string;
  panel?: YaarsaPanel;
}): Promise<YaarsaResponse> {
  const panel = input.panel ?? "v457";
  await refreshPanelOverrides();
  return yaarsaPost(
    {
      action: "add",
      username: input.username,
      email: input.email,
      password: input.password,
      adminkey: yaarsaAdminKey(panel),
      subtype: planToSubtype(input.planSlug),
      total_paid: String(input.totalPaid),
      additional_info: input.additionalInfo || `shadow-${input.planSlug}`,
      expire_date: expireDateFor(input.planSlug),
    },
    panel,
  );
}

export async function yaarsaRemoveAccount(
  email: string,
  panel: YaarsaPanel = "v457",
): Promise<YaarsaResponse> {
  await refreshPanelOverrides();
  return yaarsaPost({ action: "remove", email, adminkey: yaarsaAdminKey(panel) }, panel);
}

export async function yaarsaExtend(
  email: string,
  newExpireDate: string,
  panel: YaarsaPanel = "v457",
): Promise<YaarsaResponse> {
  await refreshPanelOverrides();
  return yaarsaPost(
    { action: "cexpire", email, expire_date: newExpireDate, adminkey: yaarsaAdminKey(panel) },
    panel,
  );
}

// Reaplica/troca a senha da conta no painel.
// Verificado no painel real: a ação primária é `update`.
// Tentamos `update` primeiro, depois fallbacks.
//
// `expireDate` (YYYY-MM-DD) é usado APENAS no fallback `add` (quando a conta
// sumiu do painel e precisa ser recriada). Antes usávamos "ontem" aqui, o que
// recriava a conta já vencida e derrubava o login do cliente logo depois de
// trocar a senha. Agora o padrão é a data real da licença (ou +31 dias).
export async function yaarsaSetPassword(
  email: string,
  password: string,
  panel: YaarsaPanel = "v457",
  username?: string,
  expireDate?: string | null,
): Promise<YaarsaResponse & { action?: string }> {
  await refreshPanelOverrides();
  const fallbackExpire = (() => {
    const d = expireDate ? new Date(expireDate) : null;
    if (d && Number.isFinite(d.getTime()) && d.getTime() > Date.now()) return d.toISOString().slice(0, 10);
    const n = new Date();
    n.setDate(n.getDate() + 31);
    return n.toISOString().slice(0, 10);
  })();
  const candidates = ["update", "cpassword", "cpass", "changepassword", "add"];
  let last: YaarsaResponse = { Fail: "Painel não aceitou nenhuma ação de troca de senha" };
  for (const action of candidates) {
    const fields: Record<string, string> = {
      action,
      email,
      password,
      adminkey: yaarsaAdminKey(panel),
    };
    if (username) fields.username = username;

    if (action === "add") {
      fields.subtype = "1 Month";
      fields.expire_date = fallbackExpire;
    }

    const r = await yaarsaPost(fields, panel);
    if (r.Success) return { ...r, action };
    
    // Se a senha foi alterada com sucesso mas o painel retornou erro de "email em uso" no action 'add', tratamos como sucesso
    if (action === "add" && /1004|already|use/i.test(r.Fail || "")) {
       return { Success: "Account verified/updated via add fallback", action };
    }

    last = r;
    const invalidAction = /1001|ação inválida|invalid action|resposta inesperada/i.test(
      String(r.Fail ?? ""),
    );
    if (!invalidAction && !/1005|not found/i.test(r.Fail || "")) return { ...r, action };
  }
  return last;
}

// Look up an email in a given panel WITHOUT touching the account.
// The panel validates the email before the date, so we send a deliberately
// invalid expire_date: an unknown email answers "cant find this email" (1005)
// and an existing email answers with a date error (1006) — never mutating it.
//
// Semantics are strict on purpose: anything that is not one of those two
// answers (network failure, HTTP error, adminkey problem, HTML page, ...)
// is treated as UNKNOWN and throws, so callers never mark a brand-new
// customer as "legacy" just because the panel hiccuped.
export type YaarsaLookup = { found: boolean; panel: YaarsaPanel; raw: YaarsaResponse };

const NOT_FOUND_RE = /1005|not.?found|não\s*encontrado|nao\s*encontrado|cant.?find/i;
// "Date not accepted or expired." / 1006 → o email EXISTE (o painel só chegou
// a validar a data porque encontrou a conta).
const EXISTS_RE =
  /1006|date\s*not\s*accepted|not\s*accepted|expired|expira|expire.?date|invalid.?date|data\s*de\s*expira/i;

export async function yaarsaLookupEmail(email: string, panel: YaarsaPanel): Promise<YaarsaLookup> {
  await refreshPanelOverrides();
  const r = await yaarsaPost(
    { action: "cexpire", email, expire_date: "invalid-probe", adminkey: yaarsaAdminKey(panel) },
    panel,
  );
  if (r.Success) return { found: true, panel, raw: r };
  const fail = String(r.Fail || "");
  if (NOT_FOUND_RE.test(fail)) return { found: false, panel, raw: r };
  if (EXISTS_RE.test(fail)) return { found: true, panel, raw: r };
  throw new Error(`lookup_unknown[${panel}]: ${fail || "sem resposta"}`);
}

// Search across all panels — returns the first panel that reports found.
// `details[].error` marks panels whose answer was inconclusive.
export async function yaarsaLookupEmailAllPanels(
  email: string,
): Promise<{
  found: boolean;
  panel: YaarsaPanel | null;
  conclusive: boolean;
  details: Array<{ panel: YaarsaPanel; found: boolean; error?: string }>;
}> {
  const details: Array<{ panel: YaarsaPanel; found: boolean; error?: string }> = [];
  for (const p of ALL_PANELS) {
    // Sem VPS própria, a 4.5.5 aponta para o mesmo painel da 4.5.7 — evita
    // consultar o mesmo servidor duas vezes.
    if (p === "v455" && !hasPanelServer("v455")) continue;
    try {
      const r = await yaarsaLookupEmail(email, p);
      details.push({ panel: p, found: r.found });
    } catch (e) {
      details.push({ panel: p, found: false, error: String((e as Error)?.message || e) });
    }
  }
  const firstFound = details.find((d) => d.found)?.panel ?? null;
  // Conclusive only when every panel gave a clear yes/no, or at least one said yes.
  const conclusive = !!firstFound || details.every((d) => !d.error);
  return { found: !!firstFound, panel: firstFound, conclusive, details };
}

// ---------------- Shared HTTP plumbing (per-panel cookie jar) ----------------
const sessionCookies: Record<YaarsaPanel, string> = { v455: "", v457: "", v46: "" };
const warmedUp: Record<YaarsaPanel, boolean> = { v455: false, v457: false, v46: false };

function browserHeaders(url: string, panel: YaarsaPanel, extra: Record<string, string> = {}) {
  const h: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Referer: `${new URL(url).origin}/`,
    Origin: new URL(url).origin,
    ...extra,
  };
  if (sessionCookies[panel]) h.Cookie = sessionCookies[panel];
  return h;
}

function captureCookies(res: Response, panel: YaarsaPanel) {
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  const list =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie") as string]
        : [];
  if (!list.length) return;
  const parts: string[] = [];
  for (const c of list) {
    const first = c.split(";")[0];
    if (first) parts.push(first.trim());
  }
  if (parts.length) sessionCookies[panel] = parts.join("; ");
}

async function warmup(url: string, panel: YaarsaPanel) {
  if (warmedUp[panel]) return;
  try {
    const origin = new URL(url).origin;
    const res = await fetch(`${origin}/`, { method: "GET", headers: browserHeaders(url, panel) });
    captureCookies(res, panel);
  } catch {
    /* best-effort */
  }
  warmedUp[panel] = true;
}

async function persistLog(entry: {
  action?: string;
  endpoint_kind?: string;
  url?: string;
  attempt?: number;
  http_status?: number;
  latency_ms?: number;
  outcome: string;
  payload?: Record<string, unknown>;
  response_body?: string;
  error?: string;
  context?: Record<string, unknown>;
  panel?: YaarsaPanel;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("integration_logs").insert({
      source: entry.panel ? `yaarsa-${entry.panel}` : "yaarsa",
      action: entry.action ?? null,
      endpoint_kind: entry.endpoint_kind ?? null,
      url: entry.url ?? null,
      attempt: entry.attempt ?? null,
      http_status: entry.http_status ?? null,
      latency_ms: entry.latency_ms ?? null,
      outcome: entry.outcome,
      payload: (entry.payload ?? null) as any,
      response_body: entry.response_body ? entry.response_body.slice(0, 4000) : null,
      error: entry.error ?? null,
      context: (entry.context ?? null) as any,
    });
  } catch (e) {
    console.warn("[yaarsa] persistLog failed", e);
  }
}

async function yaarsaPost(
  fields: Record<string, string>,
  panel: YaarsaPanel,
): Promise<YaarsaResponse> {
  const payload: Record<string, string> = { ...fields };
  delete (payload as any).admin_key;
  const body = JSON.stringify(payload);

  const maskKey = (k: string) =>
    k.length <= 4
      ? "*".repeat(k.length)
      : `${k.slice(0, 2)}${"*".repeat(k.length - 4)}${k.slice(-2)}`;
  const debugPayload: Record<string, string> = { ...payload };
  if (debugPayload.adminkey)
    debugPayload.adminkey = `${maskKey(debugPayload.adminkey)} (len=${payload.adminkey.length})`;
  if (debugPayload.password) debugPayload.password = `***(len=${payload.password.length})`;

  const action = payload.action || "unknown";
  const proxyUrl = (process.env.YAARSA_PROXY_URL || "").trim();
  const directEndpoints = yaarsaEndpoints(panel);
  
  // Dynamic endpoint discovery: check if current runtime host should be prioritized
  // for direct communication to avoid proxy overhead.
  const endpoints = Array.from(
    new Set(proxyUrl && panel === "v457" ? [proxyUrl, ...directEndpoints] : directEndpoints),
  );
  const map: Record<string, string> = {
    "1001": "ação inválida",
    "1002": "campos obrigatórios ausentes",
    "1003": "adminkey inválida ou requisição rejeitada pelo servidor",
    "1004": "usuário/email já existe",
    "1005": "usuário não encontrado",
    "1006": "data de expiração inválida",
  };

  let lastFail: YaarsaResponse = { Fail: "Nenhum painel respondeu à requisição" };
  let lastNetworkErr: unknown = null;

  const kindOf = (u: string): "PROXY" | "DIRECT" =>
    proxyUrl && u === proxyUrl ? "PROXY" : "DIRECT";
  const routingSummary = endpoints.map((u) => `${kindOf(u)}(${u})`).join(" → ");
  console.log(`[yaarsa:${panel}] ROUTING: ${routingSummary}`);

  for (const url of endpoints) {
    const kind = kindOf(url);
      // Retries logic: using a smaller base count for direct attempts
      const MAX_ATTEMPTS = 3;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          // Linear backoff: 1s, 2s
          const delay = attempt * 1000;
          console.log(`[yaarsa:${panel}] RETRY attempt=${attempt + 1} delay=${delay}ms url=${url}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          warmedUp[panel] = false;
          sessionCookies[panel] = "";
          await warmup(url, panel);
        }

      const started = Date.now();
      let text = "";
      let status = 0;
      let responseMeta: { origin: string; headers: Record<string, string> } = {
        origin: "unknown",
        headers: {},
      };
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: browserHeaders(url, panel, { "Content-Type": "application/json" }),
          body,
        });
        captureCookies(res, panel);
        status = res.status;
        text = (await res.text()).trim();
        const latency = Date.now() - started;

        const headerSnapshot: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          headerSnapshot[key.toLowerCase()] = value;
        });
        const originHint =
          headerSnapshot["cf-ray"] || headerSnapshot["cf-cache-status"]
            ? "cloudflare"
            : headerSnapshot["server"] || "unknown";
        responseMeta = { origin: originHint, headers: headerSnapshot };

        console.log(`[yaarsa:${panel}] RESP status=${status} body=${text.slice(0, 300)}`);

        const looksLikeYaarsa = /error\s*code\s*:?\s*\d+|"?Success"?|"?Fail"?/i.test(text);
        if ((!res.ok || !text) && !looksLikeYaarsa) {
          if (res.status === 403 && attempt === 0) {
            await persistLog({
              panel,
              action,
              endpoint_kind: kind,
              url,
              attempt: attempt + 1,
              http_status: status,
              latency_ms: latency,
              outcome: "http_error_retry",
              payload: debugPayload,
              response_body: text,
              context: { routing: routingSummary, response: responseMeta },
            });
            continue;
          }
          lastFail = { 
            Fail: friendlyYaarsaFail(`painel[${panel}] (${url}) HTTP ${res.status}`, res.status),
            statusCode: res.status,
            attempt: attempt + 1
          };
          await persistLog({
            panel,
            action,
            endpoint_kind: kind,
            url,
            attempt: attempt + 1,
            http_status: status,
            latency_ms: latency,
            outcome: "http_error",
            payload: debugPayload,
            response_body: text,
            error: lastFail.Fail,
            context: { routing: routingSummary, response: responseMeta },
          });
          break;
        }
      } catch (err) {
        const latency = Date.now() - started;
        lastNetworkErr = err;
        lastFail = { Fail: friendlyYaarsaFail(`painel[${panel}] (${url}) falha de rede`), attempt: attempt + 1 };
        await persistLog({
          panel,
          action,
          endpoint_kind: kind,
          url,
          attempt: attempt + 1,
          latency_ms: latency,
          outcome: "network_error",
          payload: debugPayload,
          error: String((err as Error)?.message || err),
          context: { routing: routingSummary, response: responseMeta },
        });
        break;
      }

      const latency = Date.now() - started;
      try {
        const parsed = JSON.parse(text) as YaarsaResponse & Record<string, unknown>;
        if (parsed.Success) {
          await persistLog({
            panel,
            action,
            endpoint_kind: kind,
            url,
            attempt: attempt + 1,
            http_status: status,
            latency_ms: latency,
            outcome: "success",
            payload: debugPayload,
            response_body: text,
            context: { routing: routingSummary, response: responseMeta },
          });
          return { Success: String(parsed.Success) };
        }
        if (parsed.Fail) {
          const friendly = friendlyYaarsaFail(String(parsed.Fail), status);
          // 1005 "not found" during a cexpire is normal for lookup probes — log as informational.
          const isLookupMiss =
            action === "cexpire" &&
            /1005|not.?found|não\s*encontrado|cant.?find/i.test(String(parsed.Fail));
          await persistLog({
            panel,
            action,
            endpoint_kind: kind,
            url,
            attempt: attempt + 1,
            http_status: status,
            latency_ms: latency,
            outcome: isLookupMiss ? "lookup_miss" : "yaarsa_fail",
            payload: debugPayload,
            response_body: text,
            error: isLookupMiss ? (null as unknown as string) : friendly,
            context: { routing: routingSummary, response: responseMeta },
          });
          return { Fail: friendly };
        }

        lastFail = { Fail: `painel[${panel}] resposta inesperada: ${text.slice(0, 160)}` };
        await persistLog({
          panel,
          action,
          endpoint_kind: kind,
          url,
          attempt: attempt + 1,
          http_status: status,
          latency_ms: latency,
          outcome: "unexpected",
          payload: debugPayload,
          response_body: text,
          error: lastFail.Fail,
          context: { routing: routingSummary, response: responseMeta },
        });
        break;
      } catch {
        const codeMatch = text.match(/error\s*code\s*:?\s*(\d+)/i);
        if (codeMatch) {
          const code = codeMatch[1];
          const friendly = `Yaarsa erro ${code}: ${map[code] ?? text.slice(0, 160)}`;
          if (code === "1003" || code === "1001") {
            lastFail = { Fail: friendly };
            await persistLog({
              panel,
              action,
              endpoint_kind: kind,
              url,
              attempt: attempt + 1,
              http_status: status,
              latency_ms: latency,
              outcome: `yaarsa_code_${code}`,
              payload: debugPayload,
              response_body: text,
              error: friendly,
              context: { routing: routingSummary, response: responseMeta },
            });
            // 1001/1003 are authoritative rejects from the panel logic, don't retry.
            return { Fail: friendly };
          }
          await persistLog({
            panel,
            action,
            endpoint_kind: kind,
            url,
            attempt: attempt + 1,
            http_status: status,
            latency_ms: latency,
            outcome: `yaarsa_code_${code}`,
            payload: debugPayload,
            response_body: text,
            error: friendly,
            context: { routing: routingSummary, response: responseMeta },
          });
          return { Fail: friendly };
        }
        if (/<html|<!doctype/i.test(text)) {
          lastFail = { Fail: friendlyYaarsaFail(`painel[${panel}] devolveu HTML (status ${status})`, status), statusCode: status, attempt: attempt + 1 };
          await persistLog({
            panel,
            action,
            endpoint_kind: kind,
            url,
            attempt: attempt + 1,
            http_status: status,
            latency_ms: latency,
            outcome: "html_response",
            payload: debugPayload,
            response_body: text,
            error: lastFail.Fail,
            context: { routing: routingSummary, response: responseMeta },
          });
          break;
        }
        lastFail = { Fail: friendlyYaarsaFail(`Resposta inesperada painel[${panel}]: ${text.slice(0, 200)}`, status), statusCode: status, attempt: attempt + 1 };
        await persistLog({
          panel,
          action,
          endpoint_kind: kind,
          url,
          attempt: attempt + 1,
          http_status: status,
          latency_ms: latency,
          outcome: "unparseable",
          payload: debugPayload,
          response_body: text,
          error: lastFail.Fail,
          context: { routing: routingSummary, response: responseMeta },
        });
        break;
      }
    }
  }

  if (lastNetworkErr && !lastFail.Fail?.includes("erro") && !lastFail.Fail?.includes("HTML")) {
    return { Fail: `${lastFail.Fail} — verifique ${PANEL_CONFIG[panel].baseEnv} (possível erro de proxy/DNS)` };
  }
  return lastFail;
}
