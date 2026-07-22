// Server-only helpers for Yaarsa integration and license credential encryption.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// ============================================================================
// MULTI-PANEL SUPPORT
// ----------------------------------------------------------------------------
// We now talk to two Yaarsa VPS instances:
//   - v457: original panel (Shadow 4.5.7)  → YAARSA_BASE_URL + YAARSA_ADMIN_KEY
//   - v46 : newer panel   (Shadow 4.6+)    → YAARSA_V46_BASE_URL + YAARSA_V46_ADMIN_KEY
// Every public helper accepts an optional `panel` argument. When omitted we
// default to `v457` (the original panel) so old call sites keep working.
// ============================================================================
export type YaarsaPanel = "v457" | "v46";

export function panelFromTier(tier: string | null | undefined): YaarsaPanel {
  return tier === "lifetime_46" ? "v46" : "v457";
}

export function panelFromPlanSlug(slug: string | null | undefined): YaarsaPanel {
  if (!slug) return "v457";
  const s = slug.toLowerCase();
  if (s.includes("lifetime")) return "v46";
  return "v457";
}

type PanelConfig = { baseEnv: string; keyEnv: string; defaultUrl: string };
const PANEL_CONFIG: Record<YaarsaPanel, PanelConfig> = {
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

// Resolve the Yaarsa API endpoints for a given panel.
// Honor the configured URL as-is when it points to a callable .php entry
// (e.g. /yaarsa/proxy.php or /yaarsa/private/createacc.php). Only reject the
// admin-UI path (create9999.php) and normalize bare hosts to /yaarsa/proxy.php
// (with private/createacc.php as a secondary fallback).
function yaarsaEndpoints(panel: YaarsaPanel): string[] {
  const cfg = PANEL_CONFIG[panel];
  const configured = (process.env[cfg.baseEnv] || cfg.defaultUrl).trim().replace(/\/+$/, "");
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
  }

  const seen = new Set<string>();
  return endpoints.filter((u) => {
    const k = u.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function yaarsaAdminKey(panel: YaarsaPanel): string {
  const cfg = PANEL_CONFIG[panel];
  const raw = process.env[cfg.keyEnv];
  if (!raw) throw new Error(`${cfg.keyEnv} not set`);
  const cleaned = raw
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .replace(/^["']|["']$/g, "");
  if (!cleaned) throw new Error(`${cfg.keyEnv} is empty after sanitization`);
  if (/[^\x21-\x7E]/.test(cleaned)) {
    throw new Error(`${cfg.keyEnv} contains invalid characters (only printable ASCII allowed)`);
  }
  return cleaned;
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
    .split("").sort(() => Math.random() - 0.5).join("");
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
    pick(lower, 6), pick(lower, 7), pick(lower, 8), pick(lower, 9),
    pick(upper, 10), pick(upper, 11), pick(upper, 12),
    pick(digits, 13), pick(digits, 14), pick(digits, 15),
    pick(specials, 16), pick(specials, 17),
  ];
  for (let i = pw.length - 1; i > 0; i--) {
    const j = h[18 + (i % 14)] % (i + 1);
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return { username: uname, email, password: pw.join("") };
}

export function planToSubtype(planSlug: string): string {
  if (planSlug === "login-7d") return "7 Days";
  if (planSlug === "login-30d") return "1 Month";
  if (planSlug === "login-lifetime") return "12 Month";
  return "1 Month";
}

export function expireDateFor(planSlug: string): string {
  // BMob invalida logins na virada da meia-noite, então damos 1 dia de buffer
  // no Yaarsa. O corte real acontece pelo cron /api/public/hooks/expire-licenses,
  // que remove a conta assim que o expires_at persistido no banco é atingido.
  const d = new Date();
  if (planSlug === "login-7d") d.setDate(d.getDate() + 8);
  else if (planSlug === "login-30d") d.setDate(d.getDate() + 31);
  else if (planSlug === "login-lifetime") d.setFullYear(d.getFullYear() + 20);
  else if (planSlug === "trial") d.setDate(d.getDate() + 2);
  else d.setDate(d.getDate() + 31);
  return d.toISOString().slice(0, 10);
}

type YaarsaResponse = { Success?: string; Fail?: string };

function friendlyYaarsaFail(message: string): string {
  const m = message.trim();
  if (/please check admin key|admin key/i.test(m)) return "Chave administrativa do painel foi rejeitada. Avise o suporte para revalidar as credenciais.";
  if (/already.*use|already.*exist|email.*use|1004|existe/i.test(m)) return "Este usuário/e-mail já existe no painel. Se for seu, use a opção de cliente antigo.";
  if (/maximum allowed accounts reached|allowed accounts|limite.*100|100.*accounts/i.test(m)) return "O painel atingiu o limite de 100 contas para esta chave. Contate o suporte para liberar espaço.";
  if (/cant find|not found|1005|não encontrado/i.test(m)) return "Usuário não encontrado neste painel.";
  if (/date not accepted|1006|expired|expira/i.test(m)) return "Data de expiração recusada pelo painel. Tente novamente em instantes.";
  if (/array offset on null|undefined offset|trying to access|warning:|notice:/i.test(m)) return "O painel devolveu uma resposta inválida (erro interno). Tente novamente em alguns segundos.";
  if (/HTTP 403/i.test(m)) return "O painel bloqueou temporariamente esta requisição (403). Tentando rota alternativa — se persistir, avise o suporte.";
  if (/devolveu HTML/i.test(m)) return "O painel devolveu uma página HTML em vez de dados. Provavelmente está em manutenção — tente novamente em breve.";
  if (/falha de rede/i.test(m)) return "Falha de rede ao contatar o painel. Verifique sua conexão e tente novamente.";
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
  return yaarsaPost({
    action: "add",
    username: input.username,
    email: input.email,
    password: input.password,
    adminkey: yaarsaAdminKey(panel),
    subtype: planToSubtype(input.planSlug),
    total_paid: String(input.totalPaid),
    additional_info: input.additionalInfo || `shadow-${input.planSlug}`,
    expire_date: expireDateFor(input.planSlug),
  }, panel);
}

export async function yaarsaRemoveAccount(email: string, panel: YaarsaPanel = "v457"): Promise<YaarsaResponse> {
  return yaarsaPost({ action: "remove", email, adminkey: yaarsaAdminKey(panel) }, panel);
}

export async function yaarsaExtend(email: string, newExpireDate: string, panel: YaarsaPanel = "v457"): Promise<YaarsaResponse> {
  return yaarsaPost({ action: "cexpire", email, expire_date: newExpireDate, adminkey: yaarsaAdminKey(panel) }, panel);
}

// Look up an email in a given panel by attempting a benign cexpire with a
// future date (tomorrow, UTC). Yaarsa returns 1005 ("not found") when the
// email doesn't exist; using a future date avoids false 1006 rejections when
// the panel treats today's date as already-expired.
export async function yaarsaLookupEmail(email: string, panel: YaarsaPanel): Promise<{ found: boolean; panel: YaarsaPanel; raw: YaarsaResponse }> {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await yaarsaPost(
    { action: "cexpire", email, expire_date: tomorrow, adminkey: yaarsaAdminKey(panel) },
    panel,
  );
  const notFound = !!r.Fail && /1005|not.?found|não\s*encontrado|cant.?find/i.test(r.Fail);
  return { found: !notFound, panel, raw: r };
}


// Search across all panels — returns the first panel that reports found.
export async function yaarsaLookupEmailAllPanels(email: string): Promise<{ found: boolean; panel: YaarsaPanel | null; details: Array<{ panel: YaarsaPanel; found: boolean; error?: string }> }> {
  const details: Array<{ panel: YaarsaPanel; found: boolean; error?: string }> = [];
  for (const p of ["v457", "v46"] as YaarsaPanel[]) {
    try {
      const r = await yaarsaLookupEmail(email, p);
      details.push({ panel: p, found: r.found });
    } catch (e) {
      details.push({ panel: p, found: false, error: String((e as Error)?.message || e) });
    }
  }
  const firstFound = details.find((d) => d.found)?.panel ?? null;
  return { found: !!firstFound, panel: firstFound, details };
}

// ---------------- Shared HTTP plumbing (per-panel cookie jar) ----------------
const sessionCookies: Record<YaarsaPanel, string> = { v457: "", v46: "" };
const warmedUp: Record<YaarsaPanel, boolean> = { v457: false, v46: false };

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
  } catch { /* best-effort */ }
  warmedUp[panel] = true;
}

async function persistLog(entry: {
  action?: string; endpoint_kind?: string; url?: string; attempt?: number;
  http_status?: number; latency_ms?: number; outcome: string;
  payload?: Record<string, unknown>; response_body?: string; error?: string;
  context?: Record<string, unknown>; panel?: YaarsaPanel;
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

async function yaarsaPost(fields: Record<string, string>, panel: YaarsaPanel): Promise<YaarsaResponse> {
  const payload: Record<string, string> = { ...fields };
  delete (payload as any).admin_key;
  const body = JSON.stringify(payload);

  const maskKey = (k: string) =>
    k.length <= 4 ? "*".repeat(k.length) : `${k.slice(0, 2)}${"*".repeat(k.length - 4)}${k.slice(-2)}`;
  const debugPayload: Record<string, string> = { ...payload };
  if (debugPayload.adminkey) debugPayload.adminkey = `${maskKey(debugPayload.adminkey)} (len=${payload.adminkey.length})`;
  if (debugPayload.password) debugPayload.password = `***(len=${payload.password.length})`;

  const action = payload.action || "unknown";
  const proxyUrl = (process.env.YAARSA_PROXY_URL || "").trim();
  const directEndpoints = yaarsaEndpoints(panel);
  // Proxy only applies to the original v457 panel (that's what it was set up for).
  const endpoints = Array.from(
    new Set(proxyUrl && panel === "v457" ? [proxyUrl, ...directEndpoints] : directEndpoints),
  );
  const map: Record<string, string> = {
    "1001": "ação inválida", "1002": "campos obrigatórios ausentes",
    "1003": "adminkey inválida ou requisição rejeitada pelo servidor",
    "1004": "usuário/email já existe", "1005": "usuário não encontrado",
    "1006": "data de expiração inválida",
  };

  let lastFail: YaarsaResponse = { Fail: "Nenhum painel respondeu à requisição" };
  let lastNetworkErr: unknown = null;

  const kindOf = (u: string): "PROXY" | "DIRECT" => (proxyUrl && u === proxyUrl ? "PROXY" : "DIRECT");
  const routingSummary = endpoints.map((u) => `${kindOf(u)}(${u})`).join(" → ");
  console.log(`[yaarsa:${panel}] ROUTING: ${routingSummary}`);

  for (const url of endpoints) {
    const kind = kindOf(url);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt === 1) {
        warmedUp[panel] = false;
        sessionCookies[panel] = "";
        await warmup(url, panel);
      }

      const started = Date.now();
      let text = "";
      let status = 0;
      let responseMeta: { origin: string; headers: Record<string, string> } = { origin: "unknown", headers: {} };
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
        res.headers.forEach((value, key) => { headerSnapshot[key.toLowerCase()] = value; });
        const originHint =
          headerSnapshot["cf-ray"] || headerSnapshot["cf-cache-status"] ? "cloudflare" : headerSnapshot["server"] || "unknown";
        responseMeta = { origin: originHint, headers: headerSnapshot };

        console.log(`[yaarsa:${panel}] RESP status=${status} body=${text.slice(0, 300)}`);

        const looksLikeYaarsa = /error\s*code\s*:?\s*\d+|"?Success"?|"?Fail"?/i.test(text);
        if ((!res.ok || !text) && !looksLikeYaarsa) {
          if (res.status === 403 && attempt === 0) {
            await persistLog({ panel, action, endpoint_kind: kind, url, attempt: attempt + 1, http_status: status, latency_ms: latency, outcome: "http_error_retry", payload: debugPayload, response_body: text, context: { routing: routingSummary, response: responseMeta } });
            continue;
          }
          lastFail = { Fail: `painel[${panel}] (${url}) HTTP ${res.status}` };
          await persistLog({ panel, action, endpoint_kind: kind, url, attempt: attempt + 1, http_status: status, latency_ms: latency, outcome: "http_error", payload: debugPayload, response_body: text, error: lastFail.Fail, context: { routing: routingSummary, response: responseMeta } });
          break;
        }
      } catch (err) {
        const latency = Date.now() - started;
        lastNetworkErr = err;
        lastFail = { Fail: `painel[${panel}] (${url}) falha de rede` };
        await persistLog({ panel, action, endpoint_kind: kind, url, attempt: attempt + 1, latency_ms: latency, outcome: "network_error", payload: debugPayload, error: String((err as Error)?.message || err), context: { routing: routingSummary, response: responseMeta } });
        break;
      }

      const latency = Date.now() - started;
      try {
        const parsed = JSON.parse(text) as YaarsaResponse & Record<string, unknown>;
        if (parsed.Success) {
          await persistLog({ panel, action, endpoint_kind: kind, url, attempt: attempt + 1, http_status: status, latency_ms: latency, outcome: "success", payload: debugPayload, response_body: text, context: { routing: routingSummary, response: responseMeta } });
          return { Success: String(parsed.Success) };
        }
        if (parsed.Fail) {
          const friendly = friendlyYaarsaFail(String(parsed.Fail));
          // 1005 "not found" during a cexpire is normal for lookup probes — log as informational.
          const isLookupMiss = action === "cexpire" && /1005|not.?found|não\s*encontrado|cant.?find/i.test(String(parsed.Fail));
          await persistLog({ panel, action, endpoint_kind: kind, url, attempt: attempt + 1, http_status: status, latency_ms: latency, outcome: isLookupMiss ? "lookup_miss" : "yaarsa_fail", payload: debugPayload, response_body: text, error: isLookupMiss ? null as unknown as string : friendly, context: { routing: routingSummary, response: responseMeta } });
          return { Fail: friendly };
        }

        lastFail = { Fail: `painel[${panel}] resposta inesperada: ${text.slice(0, 160)}` };
        await persistLog({ panel, action, endpoint_kind: kind, url, attempt: attempt + 1, http_status: status, latency_ms: latency, outcome: "unexpected", payload: debugPayload, response_body: text, error: lastFail.Fail, context: { routing: routingSummary, response: responseMeta } });
        break;
      } catch {
        const codeMatch = text.match(/error\s*code\s*:?\s*(\d+)/i);
        if (codeMatch) {
          const code = codeMatch[1];
          const friendly = `Yaarsa erro ${code}: ${map[code] ?? text.slice(0, 160)}`;
          if (code === "1003" || code === "1001") {
            lastFail = { Fail: friendly };
            await persistLog({ panel, action, endpoint_kind: kind, url, attempt: attempt + 1, http_status: status, latency_ms: latency, outcome: `yaarsa_code_${code}`, payload: debugPayload, response_body: text, error: friendly, context: { routing: routingSummary, response: responseMeta } });
            break;
          }
          await persistLog({ panel, action, endpoint_kind: kind, url, attempt: attempt + 1, http_status: status, latency_ms: latency, outcome: `yaarsa_code_${code}`, payload: debugPayload, response_body: text, error: friendly, context: { routing: routingSummary, response: responseMeta } });
          return { Fail: friendly };
        }
        if (/<html|<!doctype/i.test(text)) {
          lastFail = { Fail: `painel[${panel}] devolveu HTML (status ${status})` };
          await persistLog({ panel, action, endpoint_kind: kind, url, attempt: attempt + 1, http_status: status, latency_ms: latency, outcome: "html_response", payload: debugPayload, response_body: text, error: lastFail.Fail, context: { routing: routingSummary, response: responseMeta } });
          break;
        }
        lastFail = { Fail: `Resposta inesperada painel[${panel}]: ${text.slice(0, 200)}` };
        await persistLog({ panel, action, endpoint_kind: kind, url, attempt: attempt + 1, http_status: status, latency_ms: latency, outcome: "unparseable", payload: debugPayload, response_body: text, error: lastFail.Fail, context: { routing: routingSummary, response: responseMeta } });
        break;
      }
    }
  }

  if (lastNetworkErr && !lastFail.Fail?.includes("erro")) {
    return { Fail: `${lastFail.Fail} — verifique ${PANEL_CONFIG[panel].baseEnv}` };
  }
  return lastFail;
}
