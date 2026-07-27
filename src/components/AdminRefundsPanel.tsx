import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RotateCcw, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { adminListRefunds, adminUpdateRefund } from "@/lib/refunds.functions";
import { formatBrl } from "@/lib/plans";

export function AdminRefundsPanel() {
  const listFn = useServerFn(adminListRefunds);
  const updateFn = useServerFn(adminUpdateRefund);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  async function load() {
    setLoading(true);
    try { setRows((await listFn()) as any[]); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function update(id: string, status: "approved" | "refunded" | "rejected") {
    setBusy(id);
    try {
      await updateFn({ data: { id, status, adminNotes: notes[id]?.trim() || null } });
      toast.success("Reembolso atualizado.");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  const visible = filter === "pending" ? rows.filter((r) => r.status === "requested" || r.status === "approved") : rows;

  return (
    <section className="terminal-card scanlines relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 bg-background/40 px-4 py-2">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-3.5 w-3.5 text-violet" />
          <span className="font-mono text-[10px] uppercase text-muted-foreground">Reembolsos · prazo de análise 2 dias</span>
        </div>
        <div className="flex items-center gap-2">
          {(["pending", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`font-mono text-[10px] uppercase ${filter === f ? "text-neon" : "text-muted-foreground hover:text-foreground"}`}>
              {f === "pending" ? "pendentes" : "todos"}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={load}>atualizar</Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center font-mono text-xs text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> carregando…
        </div>
      ) : visible.length === 0 ? (
        <div className="p-8 text-center font-mono text-xs text-muted-foreground">Nenhum pedido de reembolso.</div>
      ) : (
        <ul className="divide-y divide-border/30">
          {visible.map((r) => {
            const deadline = r.deadline_at ? new Date(r.deadline_at) : null;
            const late = deadline ? +deadline < Date.now() && r.status === "requested" : false;
            const hoursLeft = deadline ? Math.max(0, Math.ceil((+deadline - Date.now()) / 3600000)) : 0;
            return (
              <li key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-neon">{formatBrl(Number(r.amount))}</span>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">{r.status}</Badge>
                      {r.status === "requested" && (
                        <span className={`flex items-center gap-1 font-mono text-[10px] uppercase ${late ? "text-red-300" : "text-amber-300"}`}>
                          <Clock className="h-3 w-3" /> {late ? "prazo estourado" : `${hoursLeft}h restantes`}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {r.user_email ?? r.user_id} · {new Date(r.created_at).toLocaleString("pt-BR")}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">Motivo: <span className="text-foreground">{r.reason}</span></div>
                    {r.pix_key && <div className="mt-1 font-mono text-[11px] text-muted-foreground">PIX: <span className="text-foreground">{r.pix_key}</span></div>}
                  </div>
                  {r.status !== "refunded" && r.status !== "rejected" && (
                    <div className="flex w-full max-w-sm flex-col gap-2">
                      <Input value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                        placeholder="Nota para o cliente (opcional)" maxLength={500} />
                      <div className="flex flex-wrap gap-2">
                        {r.status === "requested" && (
                          <Button size="sm" disabled={busy === r.id} onClick={() => update(r.id, "approved")}>
                            <Check className="mr-1 h-3 w-3" /> Aprovar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => update(r.id, "refunded")}>
                          Marcar estornado
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => update(r.id, "rejected")}>
                          <X className="mr-1 h-3 w-3" /> Recusar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
