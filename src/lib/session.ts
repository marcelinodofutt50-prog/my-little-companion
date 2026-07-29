import { supabase } from "@/integrations/supabase/client";
import { clearTrackedEvents } from "@/lib/analytics";

/**
 * Logout com limpeza de rastros locais.
 * Remove histórico de eventos e estados de UI que possam identificar o usuário
 * no aparelho depois que ele sai da conta.
 */
export async function secureSignOut() {
  try {
    clearTrackedEvents();
  } catch {
    /* nunca bloquear o logout */
  }

  try {
    if (typeof window !== "undefined") {
      const prefixes = ["shadow:", "onboarding:", "admin:"];
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (prefixes.some((p) => k.startsWith(p))) localStorage.removeItem(k);
      }
      sessionStorage.clear();
    }
  } catch {
    /* storage indisponível */
  }

  await supabase.auth.signOut();
}
