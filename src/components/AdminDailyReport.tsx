import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CreditCard, Package, RefreshCw, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminDailyReport } from "@/lib/admin-problems.functions";
import { formatBrl } from "@/lib/plans";

export function AdminDailyReport() {
  const [report, setReport] = useState<{
    revenue: number;
    newUsers: number;
    activeLicenses: number;
    pendingRefunds: number;
    pendingApk: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fn = useServerFn(getAdminDailyReport);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fn();
      setReport(data);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const items = [
    { label: "Receita 24h", value: formatBrl(report?.revenue ?? 0), icon: <CreditCard className="h-4 w-4" />, tone: "neon" },
    { label: "Novos usuários", value: report?.newUsers ?? 0, icon: <Users className="h-4 w-4" />, tone: "primary" },
    { label: "Licenças ativas", value: report?.activeLicenses ?? 0, icon: <Activity className="h-4 w-4" />, tone: "success" },
    { label: "Reembolsos pendentes", value: report?.pendingRefunds ?? 0, icon: <Wallet className="h-4 w-4" />, tone: "warning" },
    { label: "APKs na fila", value: report?.pendingApk ?? 0, icon: <Package className="h-4 w-4" />, tone: "info" },
  ] as const;

  const iaSettingHint = "Ative a correção automática quando o sistema detectar login falho ou licença expirada, com confirmação no chat antes de executar diagnósticos.";


  return (
    <Card className="border border-border/60 bg-background/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="rounded-md bg-neon/10 p-1.5 text-neon">
            <Activity className="h-4 w-4" />
          </div>
          <CardTitle className="font-display text-sm tracking-tight">
            Relatório diário
            <span className="ml-2 font-mono text-[10px] text-muted-foreground opacity-50">
              {isCollapsed ? "[+]" : "[-]"}
            </span>
          </CardTitle>
        </button>
        <Button size="icon" variant="ghost" onClick={load} disabled={loading} className="h-7 w-7">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((it) => (
              <div
                key={it.label}
                className="rounded-md border border-border/40 bg-background/40 p-3"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {it.icon}
                  <span className="font-mono text-[10px] uppercase tracking-wider">{it.label}</span>
                </div>
                <div className="mt-1 font-display text-lg font-semibold text-foreground">{it.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
      <div className="border-t border-border/40 bg-muted/20 p-3">
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/80">
          <span className="text-neon">ℹ INFO:</span> {iaSettingHint}
        </p>
      </div>
    </Card>
  );
}
