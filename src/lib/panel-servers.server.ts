/**
 * Configuração dinâmica dos servidores (VPS) dos painéis Yaarsa.
 *
 * Antes, o endereço e a admin key de cada painel vinham SOMENTE das variáveis
 * de ambiente (YAARSA_BASE_URL / YAARSA_ADMIN_KEY e as v46). Isso obrigava um
 * redeploy toda vez que o dono trocava de VPS.
 *
 * Agora existe a tabela `panel_servers` (somente service_role): quando há um
 * registro ativo para o painel, ele tem prioridade sobre o ambiente. A admin
 * key é gravada criptografada (mesma chave AES do LICENSE_ENC_KEY) e nunca é
 * devolvida ao navegador — a interface mostra só uma máscara.
 */
import { decrypt, encrypt, type YaarsaPanel } from "@/lib/yaarsa.server";

export type PanelOverride = {
  panel: YaarsaPanel;
  label: string;
  baseUrl: string;
  adminKey: string;
  isActive: boolean;
};

type CacheEntry = { at: number; value: Map<string, PanelOverride> };
let cache: CacheEntry | null = null;
const TTL_MS = 15_000;

export function invalidatePanelCache() {
  cache = null;
}

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Lê (com cache curto) todos os overrides ativos. Nunca lança. */
export async function loadPanelOverrides(force = false): Promise<Map<string, PanelOverride>> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const map = new Map<string, PanelOverride>();
  try {
    const db = await adminDb();
    const { data, error } = await db
      .from("panel_servers")
      .select("panel,label,base_url,admin_key_enc,is_active");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (!row.is_active) continue;
      let adminKey = "";
      try {
        adminKey = decrypt(row.admin_key_enc);
      } catch {
        // Chave gravada com outra LICENSE_ENC_KEY — ignora o override para
        // não derrubar a integração (cai no ambiente).
        continue;
      }
      if (!row.base_url || !adminKey) continue;
      map.set(row.panel, {
        panel: row.panel as YaarsaPanel,
        label: row.label ?? "",
        baseUrl: String(row.base_url).trim(),
        adminKey,
        isActive: true,
      });
    }
  } catch (e) {
    console.warn("[panel-servers] override indisponível:", (e as Error)?.message);
  }
  cache = { at: Date.now(), value: map };
  return map;
}

/** Lista para o painel admin — sem expor a chave. */
export async function listPanelServersMasked() {
  const db = await adminDb();
  const { data, error } = await db
    .from("panel_servers")
    .select(
      "panel,label,base_url,admin_key_enc,notes,is_active,updated_at,updated_by_email,last_test_at,last_test_ok,last_test_message",
    )
    .order("panel");
  if (error) {
    if (/does not exist|42P01/i.test(error.message ?? "")) return [];
    throw new Error(friendlyDbError(error));
  }
  return (data ?? []).map((r: any) => {
    let masked: string | null = null;
    try {
      const k = decrypt(r.admin_key_enc);
      masked = k.length <= 4 ? "••••" : `${k.slice(0, 2)}${"•".repeat(Math.max(4, k.length - 4))}${k.slice(-2)}`;
    } catch {
      masked = null;
    }
    return {
      panel: r.panel as YaarsaPanel,
      label: r.label ?? "",
      baseUrl: r.base_url as string,
      adminKeyMasked: masked,
      adminKeyBroken: masked === null,
      notes: r.notes ?? null,
      isActive: !!r.is_active,
      updatedAt: r.updated_at as string,
      updatedByEmail: r.updated_by_email ?? null,
      lastTestAt: r.last_test_at ?? null,
      lastTestOk: r.last_test_ok ?? null,
      lastTestMessage: r.last_test_message ?? null,
    };
  });
}

export async function upsertPanelServer(input: {
  panel: YaarsaPanel;
  label: string;
  baseUrl: string;
  adminKey?: string | null;
  notes?: string | null;
  isActive: boolean;
  actorId: string;
  actorEmail?: string | null;
}) {
  const db = await adminDb();
  const patch: Record<string, unknown> = {
    panel: input.panel,
    label: input.label.slice(0, 80),
    base_url: input.baseUrl.trim(),
    notes: input.notes ? input.notes.slice(0, 500) : null,
    is_active: input.isActive,
    updated_by: input.actorId,
    updated_by_email: input.actorEmail ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.adminKey && input.adminKey.trim()) {
    patch.admin_key_enc = encrypt(input.adminKey.trim());
  } else {
    const { data: existing } = await db
      .from("panel_servers")
      .select("admin_key_enc")
      .eq("panel", input.panel)
      .maybeSingle();
    if (!existing?.admin_key_enc) throw new Error("Informe a admin key do novo servidor.");
    patch.admin_key_enc = existing.admin_key_enc;
  }
  const { error } = await db.from("panel_servers").upsert(patch, { onConflict: "panel" });
  if (error) throw new Error(friendlyDbError(error, input.panel));
  invalidatePanelCache();
}

/** Traduz erros crus do banco para algo que o admin entenda e saiba resolver. */
export function friendlyDbError(error: { message?: string; code?: string }, panel?: YaarsaPanel) {
  const msg = String(error?.message ?? "");
  if (/panel_servers_panel_check|violates check constraint/i.test(msg)) {
    return `O banco em uso ainda não conhece o painel ${panel ?? ""} (falta a atualização da tabela panel_servers). O site precisa estar apontando para o backend atualizado.`.trim();
  }
  if (/relation .*panel_servers.* does not exist|42P01/i.test(msg)) {
    return "A tabela de servidores (panel_servers) não existe no banco em uso — o site está conectado a um backend desatualizado.";
  }
  if (/permission denied|row-level security/i.test(msg)) {
    return "Sem permissão para gravar o servidor. Faça login novamente como administrador.";
  }
  return msg || "Erro desconhecido ao gravar o servidor.";
}

export async function deletePanelServer(panel: YaarsaPanel) {
  const db = await adminDb();
  const { error } = await db.from("panel_servers").delete().eq("panel", panel);
  if (error) throw new Error(friendlyDbError(error, panel));
  invalidatePanelCache();
}

export async function recordPanelTest(panel: YaarsaPanel, ok: boolean, message: string) {
  try {
    const db = await adminDb();
    await db
      .from("panel_servers")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_ok: ok,
        last_test_message: message.slice(0, 300),
      })
      .eq("panel", panel);
  } catch {
    /* diagnóstico best-effort */
  }
}

/**
 * Testa uma configuração (endereço + admin key) SEM gravar nada e SEM criar
 * conta: usamos a sonda de leitura do painel (consulta de e-mail inexistente
 * com data inválida). Respostas possíveis:
 *  - "cant find this email" / 1005  → painel OK e chave aceita
 *  - erro de adminkey / 1003        → chave inválida
 *  - HTML, timeout, HTTP 5xx        → servidor fora do ar / endereço errado
 */
export async function probePanelConfig(baseUrl: string, adminKey: string): Promise<{ ok: boolean; message: string; endpoint?: string }> {
  const { yaarsaEndpointsFor, sanitizeAdminKey } = await import("@/lib/yaarsa.server");
  let key: string;
  try {
    key = sanitizeAdminKey(adminKey, "admin key");
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const endpoints = yaarsaEndpointsFor(baseUrl);
  let last = "sem resposta do servidor";
  for (const url of endpoints) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15_000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action: "cexpire",
          email: `probe-${Date.now()}@shadow-check.invalid`,
          expire_date: "invalid-probe",
          adminkey: key,
        }),
        signal: ctl.signal,
      });
      clearTimeout(t);
      const text = (await res.text()).slice(0, 800);
      if (!res.ok) { last = `HTTP ${res.status} em ${url}`; continue; }
      if (/<html|<!doctype/i.test(text)) { last = `O endereço respondeu uma página HTML (${url})`; continue; }
      if (/1005|cant.?find|not.?found/i.test(text)) {
        return { ok: true, message: "Servidor respondeu e aceitou a admin key.", endpoint: url };
      }
      if (/1006|date\s*not\s*accepted|expired/i.test(text)) {
        return { ok: true, message: "Servidor respondeu e aceitou a admin key.", endpoint: url };
      }
      if (/1003|admin\s*key/i.test(text)) { last = "Admin key rejeitada pelo servidor."; continue; }
      last = `Resposta inesperada: ${text.slice(0, 160)}`;
    } catch (e) {
      last = `Falha de rede: ${(e as Error)?.message || "desconhecida"}`;
    }
  }
  return { ok: false, message: last };
}

/**
 * Registro auditável das verificações/alterações de VPS.
 * Grava em `integration_logs` (source = "panel_servers") para que qualquer
 * troca de servidor tenha prova do teste feito antes/depois.
 */
export async function logPanelEvent(entry: {
  panel: YaarsaPanel;
  action: string;
  outcome: "ok" | "fail";
  message: string;
  actorEmail?: string | null;
  baseUrl?: string | null;
  serverIp?: string | null;
  steps?: { step: string; ok: boolean; detail: string }[];
}) {
  try {
    const db = await adminDb();
    await db.from("integration_logs").insert({
      source: "panel_servers",
      action: entry.action,
      endpoint_kind: entry.panel,
      url: entry.baseUrl ?? null,
      outcome: entry.outcome,
      error: entry.outcome === "fail" ? entry.message.slice(0, 500) : null,
      response_body: entry.message.slice(0, 1000),
      context: {
        panel: entry.panel,
        actor: entry.actorEmail ?? null,
        serverIp: entry.serverIp ?? null,
        steps: entry.steps ?? null,
      },
    });
  } catch (e) {
    console.warn("[panel-servers] log falhou:", (e as Error)?.message);
  }
}

/** Últimos eventos registrados (para o painel admin). */
export async function listPanelEvents(limit = 25) {
  const db = await adminDb();
  const { data, error } = await db
    .from("integration_logs")
    .select("id,created_at,action,endpoint_kind,outcome,response_body,context")
    .eq("source", "panel_servers")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    at: r.created_at as string,
    action: r.action as string,
    panel: (r.endpoint_kind ?? r.context?.panel ?? "—") as string,
    ok: r.outcome === "ok",
    message: (r.response_body ?? "") as string,
    actor: (r.context?.actor ?? null) as string | null,
    steps: (r.context?.steps ?? null) as { step: string; ok: boolean; detail: string }[] | null,
  }));
}

/** Snapshot bruto de um painel (usado para desfazer uma troca reprovada). */
export async function snapshotPanelServer(panel: YaarsaPanel) {
  const db = await adminDb();
  const { data } = await db.from("panel_servers").select("*").eq("panel", panel).maybeSingle();
  return (data ?? null) as Record<string, unknown> | null;
}

/** Restaura o snapshot (ou remove o registro se antes não existia). */
export async function restorePanelServer(panel: YaarsaPanel, snap: Record<string, unknown> | null) {
  const db = await adminDb();
  if (!snap) {
    await db.from("panel_servers").delete().eq("panel", panel);
  } else {
    await db.from("panel_servers").upsert(snap, { onConflict: "panel" });
  }
  invalidatePanelCache();
}

export async function runFullPanelCheck(panel: YaarsaPanel) {
    const y = await import("@/lib/yaarsa.server");
    
    await y.refreshPanelOverrides(true);

    const steps: { step: string; ok: boolean; detail: string }[] = [];
    const push = (step: string, ok: boolean, detail: string) => steps.push({ step, ok, detail });

    const baseUrl = y.panelBaseUrl(panel);
    const serverIp = y.panelServerHost(panel);
    const source = y.panelConfigSource(panel);
    push("Endereço configurado", !!baseUrl, `${baseUrl} (origem: ${source})`);

    let keyOk = true;
    try {
      await y.yaarsaLookupEmail(`probe-${Date.now()}@shadow-check.invalid`, panel);
      push("Servidor responde e aceita a admin key", true, "resposta válida");
    } catch (e) {
      keyOk = false;
      push("Servidor responde e aceita a admin key", false, String((e as Error)?.message || e));
    }

    let created = false;
    let creds: { username: string; email: string; password: string } | null = null;
    if (keyOk) {
      creds = y.generateCredentials();
      const suffix = `-chk${Date.now().toString().slice(-5)}`;
      creds = {
        username: `${creds.username}${suffix}`.slice(0, 24),
        email: creds.email.replace("@", `${suffix}@`),
        password: creds.password,
      };
      const r = await y.yaarsaCreateAccount({
        username: creds.username,
        email: creds.email,
        password: creds.password,
        planSlug: "login-7d",
        totalPaid: 0,
        additionalInfo: "shadow-healthcheck",
        panel,
      });
      created = !r.Fail;
      push("Criar login de teste (igual a uma compra)", created, r.Fail ?? r.Success ?? "ok");
    }

    if (created && creds) {
      const ymd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const ext = await y.yaarsaExtend(creds.email, ymd, panel);
      push("Ajustar validade do login", !ext.Fail, ext.Fail ?? ext.Success ?? "ok");

      const pw = await y.yaarsaSetPassword(creds.email, creds.password, panel, creds.username);
      push("Definir senha do cliente", !pw.Fail, pw.Fail ?? pw.Success ?? "ok");

      try {
        const look = await y.yaarsaLookupEmail(creds.email, panel);
        push("Confirmar que o login existe no painel", look.found, look.found ? "encontrado" : "não encontrado");
      } catch (e) {
        push("Confirmar que o login existe no painel", false, String((e as Error)?.message || e));
      }

      const rm = await y.yaarsaRemoveAccount(creds.email, panel);
      push("Remover login de teste", !rm.Fail, rm.Fail ?? rm.Success ?? "ok");
    }

    const ok = steps.every((s) => s.ok);
    const message = ok
      ? `Tudo certo — uma compra na ${panel === "v46" ? "4.6" : panel === "v455" ? "4.5.5" : "4.5.7"} entrega o login normalmente. IP entregue ao cliente: ${serverIp}`
      : `Falhou em: ${steps.filter((s) => !s.ok).map((s) => s.step).join(", ")}`;
    await recordPanelTest(panel, ok, message);
    await logPanelEvent({ panel, action: "verificacao_completa", outcome: ok ? "ok" : "fail", message, baseUrl, serverIp, steps });
    return { ok, steps, serverIp, baseUrl, source, message };
}

