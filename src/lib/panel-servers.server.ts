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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
  invalidatePanelCache();
}

export async function deletePanelServer(panel: YaarsaPanel) {
  const db = await adminDb();
  const { error } = await db.from("panel_servers").delete().eq("panel", panel);
  if (error) throw new Error(error.message);
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
