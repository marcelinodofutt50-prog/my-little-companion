/**
 * Sincronização licença ⇄ painel Yaarsa.
 *
 * O painel é a fonte de verdade do acesso: quando o suporte ajusta a data por
 * lá (pagamento manual, correção de bug), o site precisa reconhecer isso e
 * voltar a mostrar a licença como ATIVA, com a contagem de dias certa.
 *
 * Mantido fora dos arquivos de server function porque o bundler remove código
 * irmão de `createServerFn`.
 */

import { evaluatePanelSync, type PanelSyncDecision } from "./server-renewal";

export type PanelSyncItem = {
  license_id: string;
  yaarsa_email: string | null;
  panel_date: string | null;
  action: PanelSyncDecision["action"];
  reason: string;
  expires_at?: string | null;
};

export type PanelSyncReport = {
  checked: number;
  activated: number;
  unchanged: number;
  unknown: number;
  items: PanelSyncItem[];
};

/**
 * Lê o painel de cada licença e reativa as que já estão liberadas por lá.
 * Nunca encurta acesso e nunca mexe em licença pausada/desativada.
 */
export async function syncLicensesWithPanel(
  licenses: any[],
  opts: { actor: "client" | "admin"; userId?: string } = { actor: "client" },
): Promise<PanelSyncReport> {
  const { yaarsaReadAccount } = await import("./yaarsa.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const report: PanelSyncReport = { checked: 0, activated: 0, unchanged: 0, unknown: 0, items: [] };

  for (const lic of licenses) {
    if (!lic?.yaarsa_email || lic.disabled_at || lic.suspended_at) continue;
    report.checked++;

    let panelDate: string | null = null;
    try {
      const acc = await yaarsaReadAccount(lic.yaarsa_email, lic.panel ?? "v457");
      panelDate = acc.known ? acc.expireDate : null;
    } catch {
      panelDate = null;
    }

    const decision = evaluatePanelSync(lic, panelDate);
    const item: PanelSyncItem = {
      license_id: lic.id,
      yaarsa_email: lic.yaarsa_email,
      panel_date: panelDate,
      action: decision.action,
      reason: decision.reason,
    };

    if (decision.action === "activate" && decision.patch) {
      const { error } = await supabaseAdmin
        .from("licenses")
        .update(decision.patch as any)
        .eq("id", lic.id);
      if (error) {
        item.action = "unknown";
        item.reason = `falha ao gravar: ${error.message}`;
        report.unknown++;
      } else {
        item.expires_at = (decision.patch['expires_at'] as string | undefined) ?? lic.expires_at ?? null;
        report.activated++;
      }
    } else if (decision.action === "unknown") {
      report.unknown++;
    } else {
      report.unchanged++;
    }

    report.items.push(item);
  }

  try {
    await supabaseAdmin.from("integration_logs").insert({
      source: "panel-sync",
      action: "license_panel_sync",
      outcome: report.activated ? "success" : "info",
      context: { actor: opts.actor, user_id: opts.userId ?? null, ...report } as any,
    } as any);
  } catch {
    /* telemetria best-effort */
  }

  return report;
}
