/**
 * Configurações gerais do site (tabela `app_settings`, somente service_role).
 * Usado, por exemplo, para escolher em qual servidor os próximos testes
 * grátis (trials) serão criados, sem precisar de redeploy.
 */
const TTL_MS = 10_000;
const cache = new Map<string, { at: number; value: any }>();

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export function invalidateSetting(key: string) {
  cache.delete(key);
}

/** Lê uma configuração. Nunca lança — devolve `null` em caso de falha. */
export async function getSetting<T = any>(key: string, force = false): Promise<T | null> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  try {
    const client = await db();
    const { data, error } = await client
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const value = (data?.value ?? null) as T | null;
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    console.warn("[app-settings] leitura falhou:", (e as Error)?.message);
    return null;
  }
}

/** Grava uma configuração (uso administrativo). */
export async function setSetting(key: string, value: any, updatedBy?: string | null) {
  const client = await db();
  const { error } = await client
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: updatedBy ?? null });
  if (error) throw new Error(error.message);
  cache.set(key, { at: Date.now(), value });
}

export const TRIAL_PANEL_KEY = "trial_panel";

export type TrialPanelChoice = "auto" | "v455" | "v457" | "v46";

/** Painel escolhido pelo admin para os próximos testes grátis. */
export async function getTrialPanelChoice(force = false): Promise<TrialPanelChoice> {
  const raw = await getSetting<any>(TRIAL_PANEL_KEY, force);
  const v = typeof raw === "string" ? raw : raw?.panel;
  return v === "v455" || v === "v457" || v === "v46" ? v : "auto";
}
