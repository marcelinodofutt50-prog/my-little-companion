import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { staffListAudit } from "@/lib/staff-admin.functions";
import { AdminAuditLog, type AuditLogEntry } from "@/components/AdminAuditLog";
import { Loader2 } from "lucide-react";

/**
 * Auditoria real: lê staff_audit_logs (gravado pelas ações administrativas)
 * em vez de entradas de demonstração.
 */
export function AdminAuditLogLive() {
  const listFn = useServerFn(staffListAudit);
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listFn()
      .then((rows: any) => {
        if (cancelled) return;
        setEntries(
          (rows as any[]).map((r) => ({
            id: r.id,
            date: new Date(r.created_at).toLocaleString("pt-BR"),
            admin: r.executor?.display_name || r.executor?.full_name || r.executor?.email || "sistema",
            action: String(r.action ?? "ação"),
            target:
              r.target?.display_name || r.target?.full_name || r.target?.email ||
              (r.details ? String(r.details).slice(0, 80) : "—"),
            status: "sucesso",
          })),
        );
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="terminal-card p-6 text-center text-xs text-destructive">
        Não foi possível carregar o log de auditoria. Recarregue a página para tentar de novo.
      </div>
    );
  }
  if (!entries) {
    return (
      <div className="terminal-card flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando auditoria…
      </div>
    );
  }
  return <AdminAuditLog entries={entries} />;
}
