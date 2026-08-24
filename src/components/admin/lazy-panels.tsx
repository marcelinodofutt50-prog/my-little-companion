import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";

/**
 * Carregamento sob demanda dos painéis do admin.
 *
 * O arquivo do painel importava ~30 telas pesadas de uma vez, o que deixava a
 * página lenta para abrir e travada para rolar (todo o JavaScript era
 * interpretado antes de qualquer interação). Aqui cada painel vira um pedaço
 * separado, baixado apenas quando a aba correspondente é aberta.
 */
function PanelFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-border/50 bg-background/40">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Carregando painel…
      </div>
    </div>
  );
}

/**
 * Em produção, quando um deploy novo entra no ar, os pedaços de JavaScript da
 * versão antiga deixam de existir. Se a pessoa ainda estiver com a aba aberta,
 * abrir uma aba do admin quebra com "Importing a module script failed".
 * Aqui tentamos de novo (rede instável) e, se o arquivo realmente sumiu,
 * recarregamos a página uma única vez para pegar a versão nova.
 */
const RELOAD_FLAG = "shadow:chunk-reloaded";

async function loadWithRetry<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (first) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      return await loader();
    } catch (second) {
      if (typeof window !== "undefined") {
        const already = window.sessionStorage.getItem(RELOAD_FLAG);
        if (!already) {
          window.sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
          window.location.reload();
          // Mantém o Suspense em espera enquanto a página recarrega.
          return await new Promise<T>(() => {});
        }
      }
      throw second;
    }
  }
}

if (typeof window !== "undefined") {
  // Uma vez que a aplicação carregou de verdade, liberamos um novo auto-reload
  // para o próximo deploy (sem risco de loop infinito).
  window.setTimeout(() => window.sessionStorage.removeItem(RELOAD_FLAG), 15000);
}

function lazyPanel<T extends ComponentType<any>>(loader: () => Promise<{ default: T }>): T {
  const Loaded = lazy(() => loadWithRetry(loader) as Promise<{ default: ComponentType<any> }>);
  const Wrapped = (props: any) => (
    <Suspense fallback={<PanelFallback />}>
      <Loaded {...props} />
    </Suspense>
  );
  return Wrapped as unknown as T;
}


export const LicenseAiPanel = lazyPanel(() =>
  import("@/components/LicenseAiPanel").then((m) => ({ default: m.LicenseAiPanel })));
export const AdminApkPanel = lazyPanel(() =>
  import("@/components/AdminApkPanel").then((m) => ({ default: m.AdminApkPanel })));
export const AdminRefundsPanel = lazyPanel(() =>
  import("@/components/AdminRefundsPanel").then((m) => ({ default: m.AdminRefundsPanel })));
export const AdminMarketPanel = lazyPanel(() =>
  import("@/components/AdminMarketPanel").then((m) => ({ default: m.AdminMarketPanel })));
export const AdminUpdatesPanel = lazyPanel(() =>
  import("@/components/AdminUpdatesPanel").then((m) => ({ default: m.AdminUpdatesPanel })));
export const AdminTutorialsPanel = lazyPanel(() =>
  import("@/components/AdminTutorialsPanel").then((m) => ({ default: m.AdminTutorialsPanel })));
export const AdminAnnouncementsPanel = lazyPanel(() =>
  import("@/components/AdminAnnouncementsPanel").then((m) => ({ default: m.AdminAnnouncementsPanel })));
export const AdminSupportPanel = lazyPanel(() =>
  import("@/components/support/AdminSupportPanel").then((m) => ({ default: m.AdminSupportPanel })));
export const AdminExternalPayersPanel = lazyPanel(() =>
  import("@/components/AdminExternalPayersPanel").then((m) => ({ default: m.AdminExternalPayersPanel })));
export const AdminMetricsPanel = lazyPanel(() =>
  import("@/components/AdminMetricsPanel").then((m) => ({ default: m.AdminMetricsPanel })));
export const AdminEmailMetrics = lazyPanel(() =>
  import("@/components/AdminEmailMetrics").then((m) => ({ default: m.AdminEmailMetrics })));
export const AdminAntifraudPanel = lazyPanel(() =>
  import("@/components/AdminAntifraudPanel").then((m) => ({ default: m.AdminAntifraudPanel })));
export const AdminHealthPanel = lazyPanel(() =>
  import("@/components/AdminHealthPanel").then((m) => ({ default: m.AdminHealthPanel })));
export const AdminPanelServers = lazyPanel(() =>
  import("@/components/AdminPanelServers").then((m) => ({ default: m.AdminPanelServers })));
export const AdminMigrationWaves = lazyPanel(() =>
  import("@/components/AdminMigrationWaves").then((m) => ({ default: m.AdminMigrationWaves })));
export const AdminTrialResetPanel = lazyPanel(() =>
  import("@/components/AdminTrialResetPanel").then((m) => ({ default: m.AdminTrialResetPanel })));
export const AdminSelfTestPanel = lazyPanel(() =>
  import("@/components/AdminSelfTestPanel").then((m) => ({ default: m.AdminSelfTestPanel })));
export const AdminAuditLog = lazyPanel(() =>
  import("@/components/AdminAuditLog").then((m) => ({ default: m.AdminAuditLog })));
export const AdminCustomer360 = lazyPanel(() =>
  import("@/components/AdminCustomer360").then((m) => ({ default: m.AdminCustomer360 })));
export const AdminDailyReport = lazyPanel(() =>
  import("@/components/AdminDailyReport").then((m) => ({ default: m.AdminDailyReport })));
export const AdminTeamGuide = lazyPanel(() =>
  import("@/components/AdminTeamGuide").then((m) => ({ default: m.AdminTeamGuide })));
export const AdminPermissionsMatrix = lazyPanel(() =>
  import("@/components/AdminPermissionsMatrix").then((m) => ({ default: m.AdminPermissionsMatrix })));
export const AdminTrialMonitorPanel = lazyPanel(() =>
  import("@/components/admin/AdminTrialMonitorPanel").then((m) => ({ default: m.AdminTrialMonitorPanel })));
export const AdminVipPanel = lazyPanel(() =>
  import("@/components/admin/AdminVipPanel").then((m) => ({ default: m.AdminVipPanel })));
export const AdminRedeemCodesPanel = lazyPanel(() =>
  import("@/components/admin/AdminRedeemCodesPanel").then((m) => ({ default: m.AdminRedeemCodesPanel })));
export const AdminLicenseAuditPanel = lazyPanel(() =>
  import("@/components/admin/AdminLicenseAuditPanel").then((m) => ({ default: m.AdminLicenseAuditPanel })));
export const AdminPanelIntegrityPanel = lazyPanel(() =>
  import("@/components/admin/AdminPanelIntegrityPanel").then((m) => ({ default: m.AdminPanelIntegrityPanel })));


export const AdminStaffApplicationsPanel = lazyPanel(() =>
  import("@/components/admin/AdminStaffApplicationsPanel").then((m) => ({ default: m.AdminStaffApplicationsPanel })));

export const StaffAcademyPanel = lazyPanel(() =>
  import("@/components/staff/StaffAcademyPanel").then((m) => ({ default: m.StaffAcademyPanel })));
export const StaffNexusChat = lazyPanel(() =>
  import("@/components/staff/StaffNexusChat").then((m) => ({ default: m.StaffNexusChat })));
export const RevenueSparkline = lazyPanel(() =>
  import("@/components/RevenueSparkline").then((m) => ({ default: m.RevenueSparkline })));
