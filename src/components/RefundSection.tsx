import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Clock, Check, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { getRefundOverview, requestRefund } from "@/lib/refunds.functions";
import { formatBrl } from "@/lib/plans";

type Overview = Awaited<ReturnType<typeof getRefundOverview>>;
type RefundStatus = "requested" | "approved" | "refunded" | "rejected" | "cancelled";

const STEPS: { key: RefundStatus; label: string }[] = [
  { key: "requested", label: "Solicitado" },
  { key: "approved", label: "Aprovado" },
  { key: "refunded", label: "Estornado" },
];

export function RefundSection() {
  const overviewFn = useServerFn(getRefundOverview);
  const requestFn = useServerFn(requestRefund);

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const o = await overviewFn();
      setData(o);
      if (!orderId && o.eligible[0]) setOrderId(o.eligible[0].id);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function submit() {
    if (!orderId) { toast.error("Selecione a compra."); return; }
    if (reason.trim().length < 10) { toast.error("Descreva o motivo com pelo menos 10 caracteres."); return; }
    setSubmitting(true);
    try {
      await requestFn({ data: { orderId, reason: reason.trim(), pixKey: pixKey.trim() || null } });
      toast.success("Pedido de reembolso enviado. Resposta em até 2 dias.");
      setOpen(false);
      setReason("");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  }

  const eligible = data?.eligible ?? [];
  const requests = (data?.requests ?? []) as any[];
  const windowDays = data?.windowDays ?? 7;
  const reviewDays = data?.reviewDays ?? 2;
  const canRequest = eligible.length > 0;
  const nextDeadline = eligible[0]?.days_left ?? 0;

  return (
    <div className="terminal-card scanlines relative mb-6 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-cyan" />
          <div className="font-mono text-xs uppercase text-cyan">Garantia de reembolso</div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={!canRequest}
              title={!canRequest ? `Nenhuma compra dentro dos ${windowDays} dias` : ""}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Solicitar reembolso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar reembolso</DialogTitle>
              <DialogDescription>
                Você tem até <span className="font-mono text-foreground">{windowDays} dias</span> após a compra.
                Nosso time responde em até <span className="font-mono text-foreground">{reviewDays} dias</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground">Compra</label>
                <div className="mt-1 space-y-2">
                  {eligible.map((o) => (
                    <button key={o.id} type="button" onClick={() => setOrderId(o.id)}
                      className={`w-full rounded border p-3 text-left transition ${orderId === o.id ? "border-cyan/60 bg-cyan/5" : "border-border/50 bg-background/40"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs uppercase">{o.plan_slug}</span>
                        <span className="font-mono text-sm text-neon">{formatBrl(o.amount)}</span>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        Pago em {new Date(o.paid_at).toLocaleDateString("pt-BR")} · restam {o.days_left} dia(s)
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground">Motivo</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000}
                  placeholder="Conte o que aconteceu para agilizarmos a análise." />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground">Chave PIX para estorno (opcional)</label>
                <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} maxLength={160}
                  placeholder="email, CPF, telefone ou aleatória" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Voltar</Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                Enviar pedido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-6 text-center font-mono text-xs text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> carregando…
        </div>
      ) : (
        <>
          <RefundWindowBar days={windowDays} daysLeft={canRequest ? nextDeadline : 0} active={canRequest} />
          <div className="mt-3 text-[11px] text-muted-foreground">
            {canRequest
              ? <>Sua compra mais recente ainda está dentro da janela de garantia: restam <span className="font-mono text-foreground">{nextDeadline} dia(s)</span> para pedir reembolso.</>
              : <>Nenhuma compra elegível no momento. A garantia vale por {windowDays} dias após o pagamento.</>}
          </div>

          {requests.length > 0 && (
            <ul className="mt-4 divide-y divide-border/30 rounded border border-border/40 bg-background/40">
              {requests.map((r) => <RefundRow key={r.id} row={r} reviewDays={reviewDays} />)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function RefundWindowBar({ days, daysLeft, active }: { days: number; daysLeft: number; active: boolean }) {
  const pct = active ? Math.max(4, Math.min(100, (daysLeft / days) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase text-muted-foreground">
        <span>Janela de garantia · {days} dias</span>
        <span className={active ? "text-cyan" : ""}>{active ? `${daysLeft}d restantes` : "encerrada"}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-border/40">
        <div className={`h-full rounded transition-all ${active ? "bg-cyan" : "bg-border"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RefundRow({ row, reviewDays }: { row: any; reviewDays: number }) {
  const status = row.status as RefundStatus;
  const deadline = row.deadline_at ? new Date(row.deadline_at) : null;
  const hoursLeft = deadline ? Math.max(0, Math.ceil((+deadline - Date.now()) / 3600000)) : 0;
  const idx = STEPS.findIndex((s) => s.key === status);

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-neon">{formatBrl(Number(row.amount))}</span>
            <StatusBadge status={status} />
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            Solicitado em {new Date(row.created_at).toLocaleString("pt-BR")}
            {row.processed_at && <> · Analisado em {new Date(row.processed_at).toLocaleString("pt-BR")}</>}
          </div>
          {row.reason && <div className="mt-1 text-[11px] text-muted-foreground">Motivo: <span className="text-foreground">{row.reason}</span></div>}
          {row.admin_notes && <div className="mt-1 text-[11px] text-muted-foreground">Nota do time: <span className="text-foreground">{row.admin_notes}</span></div>}
        </div>
        {status === "requested" && (
          <div className="flex items-center gap-1 font-mono text-[10px] uppercase text-amber-300">
            <Clock className="h-3 w-3" /> resposta em até {reviewDays}d ({hoursLeft}h)
          </div>
        )}
      </div>

      {status !== "rejected" && status !== "cancelled" && (
        <div className="mt-3 flex items-center gap-1">
          {STEPS.map((s, i) => {
            const done = i <= idx;
            return (
              <div key={s.key} className="flex flex-1 items-center gap-1">
                <div className={`h-1.5 flex-1 rounded ${done ? (i === idx ? "bg-cyan animate-pulse" : "bg-cyan/60") : "bg-border/40"}`} />
                <span className={`hidden font-mono text-[9px] uppercase sm:inline ${done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
      {status === "rejected" && (
        <div className="mt-2 rounded border border-red-500/30 bg-red-500/5 p-2 font-mono text-[11px] text-red-300">
          Reembolso recusado{row.admin_notes ? ` — ${row.admin_notes}` : ""}.
        </div>
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: RefundStatus }) {
  const map: Record<RefundStatus, { label: string; cls: string }> = {
    requested: { label: "Em análise", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    approved:  { label: "Aprovado",   cls: "bg-cyan-500/20 text-cyan border-cyan-500/30" },
    refunded:  { label: "Estornado",  cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    rejected:  { label: "Recusado",   cls: "bg-red-500/20 text-red-300 border-red-500/30" },
    cancelled: { label: "Cancelado",  cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status] ?? map.requested;
  return (
    <Badge variant="outline" className={`font-mono text-[10px] uppercase ${m.cls}`}>{m.label}</Badge>
  );
}
