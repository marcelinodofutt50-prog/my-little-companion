import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RotateCcw, Check, X, Clock, ShieldCheck, Sparkles, AlertTriangle, ExternalLink, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { adminListRefunds, adminUpdateRefund, adminVerifyRefundAi } from "@/lib/refunds.functions";
import { formatBrl } from "@/lib/plans";

type AiResult = {
  verdict: string;
  confidence: number;
  analysis: string;
  checks: { label: string; ok: boolean; detail: string }[];
  failedCount: number;
  gateway?: any;
  evidence?: {
    refund: Record<string, any>;
    order: Record<string, any>;
    windowDays: number;
    reviewDays: number;
    links: { gateway: string | null; userSupport: string | null };
    model: string;
    verifiedAt: string;
  };
};

function fmtDate(v: any) {
  return v ? new Date(v).toLocaleString("pt-BR") : "—";
}

function auditLabel(action: string) {
  if (action === "ai_verify") return "verificação IA";
  if (action === "status_change") return "mudança de status";
  if (action === "created") return "pedido criado";
  return action;
}


export function AdminRefundsPanel() {
  const listFn = useServerFn(adminListRefunds);
  const updateFn = useServerFn(adminUpdateRefund);
  const verifyFn = useServerFn(adminVerifyRefundAi);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [ai, setAi] = useState<Record<string, AiResult>>({});
  const [openAudit, setOpenAudit] = useState<Record<string, boolean>>({});

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

  async function verify(id: string) {
    setAiBusy(id);
    try {
      const res = (await verifyFn({ data: { id } })) as AiResult;
      setAi((a) => ({ ...a, [id]: res }));
      toast.success(`IA: ${res.verdict} (${res.confidence}% de confiança)`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setAiBusy(null); }
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

                    {ai[r.id] && (
                      <div className="mt-3 rounded-md border border-border/40 bg-background/40 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {ai[r.id].verdict === "LEGITIMO" ? (
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          )}
                          <span className="font-mono text-[10px] uppercase text-foreground">
                            IA: {ai[r.id].verdict} · {ai[r.id].confidence}% confiança
                          </span>
                          {ai[r.id].failedCount > 0 && (
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {ai[r.id].failedCount} checagem(ns) falharam
                            </Badge>
                          )}
                        </div>
                        <ul className="mt-2 space-y-0.5">
                          {ai[r.id].checks.map((c, i) => (
                            <li key={i} className="font-mono text-[10px] text-muted-foreground">
                              <span className={c.ok ? "text-emerald-400" : "text-red-400"}>{c.ok ? "✔" : "✘"}</span>{" "}
                              {c.label} — {c.detail}
                            </li>
                          ))}
                        </ul>
                        <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground">
                          {ai[r.id].analysis}
                        </pre>

                        {ai[r.id].evidence && (() => {
                          const ev = ai[r.id].evidence!;
                          const gw = ai[r.id].gateway;
                          return (
                            <div className="mt-3 border-t border-border/40 pt-2">
                              <div className="font-mono text-[10px] uppercase text-muted-foreground">
                                Evidências usadas pela IA
                              </div>
                              <dl className="mt-1 grid gap-x-4 gap-y-0.5 font-mono text-[10px] text-muted-foreground sm:grid-cols-2">
                                <div>Pedido: <span className="text-foreground">{ev.order.id ?? "não encontrado"}</span></div>
                                <div>Plano: <span className="text-foreground">{ev.order.plan_slug ?? "—"}</span></div>
                                <div>Status do pedido: <span className="text-foreground">{ev.order.status ?? "—"}</span></div>
                                <div>Pago em: <span className="text-foreground">{fmtDate(ev.order.paid_at ?? ev.order.created_at)}</span></div>
                                <div>Valor do pedido: <span className="text-foreground">{ev.order.amount != null ? formatBrl(ev.order.amount) : "—"}</span></div>
                                <div>Valor do reembolso: <span className="text-foreground">{formatBrl(ev.refund.amount)}</span></div>
                                <div>Dias desde o pagamento: <span className="text-foreground">{ev.order.days_since_payment ?? "—"} / {ev.windowDays}</span></div>
                                <div>Prazo de análise: <span className="text-foreground">{fmtDate(ev.refund.deadline_at)} ({ev.reviewDays}d)</span></div>
                                <div>Gateway status: <span className="text-foreground">{gw?.status ?? gw?.error ?? "sem pagamento vinculado"}</span></div>
                                <div>Gateway valor: <span className="text-foreground">{gw?.amount != null ? formatBrl(Number(gw.amount)) : "—"}</span></div>
                                <div>Gateway aprovado em: <span className="text-foreground">{fmtDate(gw?.date_approved)}</span></div>
                                <div>Estorno anterior: <span className="text-foreground">{gw ? (gw.refunded ? "sim" : "não") : "—"}</span></div>
                                <div>E-mail do pagador: <span className="text-foreground">{gw?.payer_email ?? "—"}</span></div>
                                <div>PIX informado: <span className="text-foreground">{ev.refund.pix_key ?? "—"}</span></div>
                              </dl>
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                {ev.links.gateway && (
                                  <a href={ev.links.gateway} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-mono text-[10px] text-neon hover:underline">
                                    <ExternalLink className="h-3 w-3" /> ver pagamento no Mercado Pago ({ev.order.mp_payment_id})
                                  </a>
                                )}
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(JSON.stringify({ ...ev, gateway: gw }, null, 2));
                                    toast.success("Evidências copiadas.");
                                  }}
                                  className="font-mono text-[10px] text-muted-foreground hover:text-foreground">
                                  copiar dados brutos
                                </button>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  modelo: {ev.model} · {fmtDate(ev.verifiedAt)}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Log de auditoria */}
                    <div className="mt-3">
                      <button
                        onClick={() => setOpenAudit((o) => ({ ...o, [r.id]: !o[r.id] }))}
                        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
                      >
                        <History className="h-3 w-3" />
                        Log de auditoria ({(r.audit ?? []).length})
                      </button>
                      {openAudit[r.id] && (
                        <ul className="mt-2 space-y-1 border-l border-border/40 pl-3">
                          {(r.audit ?? []).length === 0 && (
                            <li className="font-mono text-[10px] text-muted-foreground">sem registros</li>
                          )}
                          {(r.audit ?? []).map((a: any) => (
                            <li key={a.id} className="font-mono text-[10px] text-muted-foreground">
                              <span className="text-foreground">{fmtDate(a.created_at)}</span>
                              {" · "}
                              <span className="uppercase text-neon">{auditLabel(a.action)}</span>
                              {" · "}
                              por <span className="text-foreground">{a.actor_email ?? a.actor_id ?? "sistema"}</span>
                              {a.action === "status_change" && (
                                <> {" · "}{a.from_status ?? "—"} → <span className="text-foreground">{a.to_status}</span></>
                              )}
                              {a.action === "ai_verify" && (
                                <> {" · "}veredito <span className="text-foreground">{a.ai_verdict}</span>
                                  {a.ai_confidence != null && <> ({a.ai_confidence}%)</>}
                                </>
                              )}
                              {a.notes && <div className="pl-2 opacity-80">↳ {a.notes}</div>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>


                  </div>
                  {r.status !== "refunded" && r.status !== "rejected" && (
                    <div className="flex w-full max-w-sm flex-col gap-2">
                      <Input value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                        placeholder="Nota para o cliente (opcional)" maxLength={500} />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" disabled={aiBusy === r.id} onClick={() => verify(r.id)}>
                          {aiBusy === r.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                          Verificar com IA
                        </Button>
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
