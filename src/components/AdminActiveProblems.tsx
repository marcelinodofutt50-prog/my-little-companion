import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bug, MessageSquare, Package, RefreshCw, ShieldAlert, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAdminProblems, type AdminProblem } from "@/lib/admin-problems.functions";
import { formatBrl } from "@/lib/plans";

const icons: Record<AdminProblem["kind"], React.ReactNode> = {
  paid_no_license: <ShieldAlert className="h-4 w-4" />,
  yaarsa_failed: <Bug className="h-4 w-4" />,
  stuck_apk: <Package className="h-4 w-4" />,
  open_thread: <MessageSquare className="h-4 w-4" />,
  pending_refund: <Ticket className="h-4 w-4" />,
  old_pending_order: <AlertTriangle className="h-4 w-4" />,
};

const kindLabel: Record<AdminProblem["kind"], string> = {
  paid_no_license: "Pago sem entrega",
  yaarsa_failed: "Falha Yaarsa",
  stuck_apk: "APK travado",
  open_thread: "Ticket aberto",
  pending_refund: "Reembolso",
  old_pending_order: "Pedido antigo",
};

export function AdminActiveProblems({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [problems, setProblems] = useState<AdminProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fn = useServerFn(getAdminProblems);


  const load = async () => {
    setLoading(true);
    try {
      const data = await fn();
      setProblems(data);
      setLastSync(new Date());
    } catch {
      // silent — toast handled by caller
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const critical = problems.filter((p) => p.severity === "critical").length;
  const warning = problems.filter((p) => p.severity === "warning").length;

  return (
    <Card className="border border-border/60 bg-background/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="rounded-md bg-danger/10 p-1.5 text-danger">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <CardTitle className="font-display text-sm tracking-tight">
            Problemas ativos
            <span className="ml-2 font-mono text-[10px] text-muted-foreground opacity-50">
              {isCollapsed ? "[+]" : "[-]"}
            </span>
          </CardTitle>
        </button>
        <div className="flex items-center gap-2">
          {critical > 0 && (
            <Badge variant="outline" className="border-danger/40 bg-danger/10 text-danger">
              {critical} crítico{critical === 1 ? "" : "s"}
            </Badge>
          )}
          {warning > 0 && (
            <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-400">
              {warning} alerta{warning === 1 ? "" : "s"}
            </Badge>
          )}
          <Button size="icon" variant="ghost" onClick={load} disabled={loading} className="h-7 w-7">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="pt-0">
          {problems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/50 py-8 text-center">
              <div className="rounded-full bg-neon/10 p-2 text-neon">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">Nenhum problema ativo no momento.</p>
              {lastSync && (
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                  sincronizado {lastSync.toLocaleTimeString("pt-BR")}
                </p>
              )}
            </div>
          ) : (
            <ScrollArea className="h-72 pr-2">
              <div className="space-y-2">
                {problems.map((p) => {
                  const clickable = onNavigate && p.link;
                  const Wrapper = clickable ? "button" : "div";
                  return (
                    <Wrapper
                      key={`${p.kind}-${p.id}`}
                      onClick={clickable ? () => {
                        const tab = p.link!.match(/tab=([^&]+)/)?.[1];
                        if (tab) onNavigate!(tab);
                      } : undefined}
                      className={`group flex items-start gap-3 rounded-md border border-border/40 bg-background/40 p-2.5 transition-colors hover:border-primary/40 hover:bg-background ${clickable ? "cursor-pointer text-left" : ""}`}
                    >
                      <div
                        className={`mt-0.5 shrink-0 rounded p-1.5 ${
                          p.severity === "critical"
                            ? "bg-danger/10 text-danger"
                            : p.severity === "warning"
                            ? "bg-amber-400/10 text-amber-400"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {icons[p.kind]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {kindLabel[p.kind]}
                          </span>
                          <span className="ml-auto font-mono text-[9px] text-muted-foreground/70">
                            {new Date(p.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm font-medium leading-snug">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.detail}</p>
                        {p.userEmail && (
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">{p.userEmail}</p>
                        )}
                      </div>
                    </Wrapper>
                  );
                })}

              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}
    </Card>
  );
}
