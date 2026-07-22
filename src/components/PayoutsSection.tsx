import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DollarSign, Wallet, Loader2, Check, Clock, X, ArrowDownToLine, Receipt, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getPayoutOverview, requestPayout, confirmPayoutReceipt, cancelPayout,
} from "@/lib/payouts.functions";
import { formatBrl } from "@/lib/plans";

type Overview = Awaited<ReturnType<typeof getPayoutOverview>>;
type Method = "pix" | "cashback";

const STEPS: { key: PayoutStatus; label: string }[] = [
  { key: "requested", label: "Solicitado" },
  { key: "approved", label: "Aprovado" },
  { key: "paid", label: "Pago" },
  { key: "confirmed", label: "Recebido" },
];

type PayoutStatus = "requested" | "approved" | "paid" | "confirmed" | "rejected";

export function PayoutsSection() {
  const overviewFn = useServerFn(getPayoutOverview);
  const requestFn = useServerFn(requestPayout);
  const confirmFn = useServerFn(confirmPayoutReceipt);
  const cancelFn = useServerFn(cancelPayout);

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [method, setMethod] = useState<Method>("pix");
  const [amount, setAmount] = useState<string>("");
  const [pixKey, setPixKey] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const o = await overviewFn();
      setData(o);
      setPixKey(o.pixKey || "");
      if (!amount) setAmount(String(Math.min(o.balances.available, 150)));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function submit() {
    const val = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(val) || val <= 0) { toast.error("Informe um valor válido."); return; }
    setSubmitting(true);
    try {
      await requestFn({ data: { method, amount: val, pixKey: method === "pix" ? pixKey.trim() : null, note: note.trim() || null } });
      toast.success("Resgate solicitado. Você acompanha o status abaixo.");
      setDialogOpen(false);
      setNote("");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  }

  async function confirmReceipt(id: string) {
    setActingId(id);
    try {
      await confirmFn({ data: { id } });
      toast.success("Recebimento confirmado. Obrigado!");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setActingId(null); }
  }

  async function cancel(id: string) {
    setActingId(id);
    try {
      await cancelFn({ data: { id } });
      toast.success("Resgate cancelado.");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setActingId(null); }
  }

  const balances = data?.balances ?? { earned: 0, reserved: 0, available: 0 };
  const canRequest = balances.available >= (data?.minPayout ?? 50);
  const history = (data?.history ?? []) as any[];

  return (
    <>
      <div className="terminal-card scanlines relative mb-6 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-neon" />
            <div className="font-mono text-xs uppercase text-neon">Resgate de recompensas</div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!canRequest} title={!canRequest ? `Mínimo R$ ${(data?.minPayout ?? 50).toFixed(2)}` : ""}>
                <ArrowDownToLine className="mr-1 h-3.5 w-3.5" /> Resgatar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Solicitar resgate</DialogTitle>
                <DialogDescription>
                  Disponível: <span className="font-mono text-neon">{formatBrl(balances.available)}</span> ·
                  mínimo <span className="font-mono">{formatBrl(data?.minPayout ?? 50)}</span>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-[10px] uppercase text-muted-foreground">Método</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setMethod("pix")}
                      className={`rounded border p-3 text-left transition ${method === "pix" ? "border-neon/60 bg-neon/5" : "border-border/50 bg-background/40"}`}>
                      <div className="font-mono text-xs uppercase">PIX</div>
                      <div className="text-[11px] text-muted-foreground">Recebimento em até 48h úteis</div>
                    </button>
                    <button type="button" onClick={() => setMethod("cashback")}
                      className={`rounded border p-3 text-left transition ${method === "cashback" ? "border-neon/60 bg-neon/5" : "border-border/50 bg-background/40"}`}>
                      <div className="font-mono text-xs uppercase">Cashback</div>
                      <div className="text-[11px] text-muted-foreground">Crédito na sua conta Shadow (imediato após aprovação)</div>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase text-muted-foreground">Valor (R$)</label>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="150.00" />
                </div>
                {method === "pix" && (
                  <div>
                    <label className="font-mono text-[10px] uppercase text-muted-foreground">Chave PIX</label>
                    <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="email, CPF, telefone ou aleatória" maxLength={160} />
                  </div>
                )}
                <div>
                  <label className="font-mono text-[10px] uppercase text-muted-foreground">Observação (opcional)</label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Alguma informação para o time financeiro?" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                  Confirmar solicitação
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <BalanceCard label="Disponível" value={loading ? "…" : formatBrl(balances.available)} tone="neon" icon={DollarSign} />
          <BalanceCard label="Em processamento" value={loading ? "…" : formatBrl(balances.reserved)} tone="amber" icon={Clock} />
          <BalanceCard label="Total ganho" value={loading ? "…" : formatBrl(balances.earned)} tone="cyan" icon={Receipt} />
        </div>

        {!canRequest && !loading && (
          <div className="mt-3 flex items-start gap-2 rounded border border-border/40 bg-background/40 p-3 text-[11px] text-muted-foreground">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span>Junte pelo menos <span className="font-mono text-foreground">{formatBrl(data?.minPayout ?? 50)}</span> em recompensas confirmadas para solicitar seu primeiro resgate.</span>
          </div>
        )}
      </div>

      <div className="terminal-card scanlines relative mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 bg-background/40 px-4 py-2">
          <div className="font-mono text-[10px] uppercase text-muted-foreground">Histórico de resgates</div>
          <div className="font-mono text-[10px] text-muted-foreground">{history.length} registro(s)</div>
        </div>
        {loading ? (
          <div className="p-8 text-center font-mono text-xs text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> carregando…
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center font-mono text-xs text-muted-foreground">
            Nenhum resgate ainda. Solicite seu primeiro quando tiver saldo disponível.
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {history.map((h) => (
              <PayoutRow
                key={h.id}
                row={h}
                busy={actingId === h.id}
                onConfirm={() => confirmReceipt(h.id)}
                onCancel={() => cancel(h.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function BalanceCard({ label, value, tone, icon: Icon }: { label: string; value: string; tone: "neon" | "amber" | "cyan"; icon: any }) {
  const cls = tone === "neon" ? "text-neon" : tone === "amber" ? "text-amber-300" : "text-cyan";
  return (
    <div className="rounded border border-border/40 bg-background/40 p-4">
      <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase text-muted-foreground">
        <Icon className={`h-3 w-3 ${cls}`} /> {label}
      </div>
      <div className={`font-mono text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function PayoutRow({ row, busy, onConfirm, onCancel }: { row: any; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const status = row.status as PayoutStatus;
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-neon">{formatBrl(Number(row.amount))}</span>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              {row.method === "pix" ? "PIX" : "Cashback"}
            </Badge>
            <StatusBadge status={status} />
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            Solicitado em {new Date(row.created_at).toLocaleString("pt-BR")}
            {row.processed_at && <> · Processado em {new Date(row.processed_at).toLocaleString("pt-BR")}</>}
            {row.confirmed_at && <> · Recebido em {new Date(row.confirmed_at).toLocaleString("pt-BR")}</>}
          </div>
          {row.pix_key && row.method === "pix" && (
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">Chave: <span className="text-foreground">{row.pix_key}</span></div>
          )}
          {row.receipt_reference && (
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">Comprovante: <span className="text-foreground">{row.receipt_reference}</span></div>
          )}
          {row.admin_notes && (
            <div className="mt-1 text-[11px] text-muted-foreground">Nota do time: <span className="text-foreground">{row.admin_notes}</span></div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {status === "paid" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={busy}>
                  {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                  Confirmar recebimento
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar recebimento?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você recebeu {formatBrl(Number(row.amount))} via {row.method === "pix" ? "PIX" : "cashback"}? Isso encerra o resgate.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Ainda não</AlertDialogCancel>
                  <AlertDialogAction onClick={onConfirm}>Sim, confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {status === "requested" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" disabled={busy}>
                  <X className="mr-1 h-3 w-3" /> Cancelar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar solicitação?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O valor volta para o seu saldo disponível.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={onCancel}>Cancelar resgate</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {status !== "rejected" && <StatusTracker status={status} />}
      {status === "rejected" && (
        <div className="mt-2 rounded border border-red-500/30 bg-red-500/5 p-2 font-mono text-[11px] text-red-300">
          Resgate rejeitado{row.admin_notes ? ` — ${row.admin_notes}` : ""}.
        </div>
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: PayoutStatus }) {
  const map: Record<PayoutStatus, { label: string; cls: string }> = {
    requested: { label: "Solicitado", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    approved:  { label: "Aprovado",  cls: "bg-cyan-500/20 text-cyan border-cyan-500/30" },
    paid:      { label: "Pago",       cls: "bg-neon/20 text-neon border-neon/40" },
    confirmed: { label: "Recebido",   cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    rejected:  { label: "Rejeitado",  cls: "bg-red-500/20 text-red-300 border-red-500/30" },
  };
  const m = map[status];
  return <span className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${m.cls}`}>{m.label}</span>;
}

function StatusTracker({ status }: { status: PayoutStatus }) {
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="mt-3 flex items-center gap-1">
      {STEPS.map((s, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex flex-1 items-center gap-1">
            <div className={`h-1.5 flex-1 rounded ${done ? (active ? "bg-neon animate-pulse" : "bg-neon/60") : "bg-border/40"}`} />
            <span className={`hidden font-mono text-[9px] uppercase sm:inline ${done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
