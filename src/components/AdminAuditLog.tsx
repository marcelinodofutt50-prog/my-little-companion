import { ScrollText } from "lucide-react";

export type AuditLogEntry = {
  id: string;
  date: string;
  admin: string;
  action: string;
  target: string;
  status: "sucesso" | "falha" | "pendente" | string;
};

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "sucesso"
      ? "border-neon/40 bg-neon/10 text-neon"
      : s === "falha"
        ? "border-danger/50 bg-danger/10 text-danger"
        : "border-amber-400/50 bg-amber-400/10 text-amber-400";
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

export function AdminAuditLog({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <div className="terminal-card scanlines relative overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/40 p-3 font-mono text-xs uppercase tracking-wider text-neon">
        <ScrollText className="h-3.5 w-3.5" /> log de auditoria
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b border-border/40 font-mono text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left whitespace-nowrap">Data</th>
              <th className="p-3 text-left">Admin</th>
              <th className="p-3 text-left">Ação</th>
              <th className="p-3 text-left">Alvo</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-border/20 hover:bg-neon/5">
                <td className="p-3 font-mono text-xs whitespace-nowrap text-muted-foreground">{e.date}</td>
                <td className="p-3 font-mono text-xs">{e.admin}</td>
                <td className="p-3 font-mono text-xs text-foreground/80">{e.action}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{e.target}</td>
                <td className="p-3"><StatusPill status={e.status} /></td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">nenhum registro</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
