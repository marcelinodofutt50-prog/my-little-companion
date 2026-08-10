import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RefreshCw, ShieldCheck, Clock, Loader2, Wallet, Search, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminListExternalPayers,
  adminListLegacyCandidates,
  adminMarkPaidExternally,
  adminUnmarkPaidExternally,
} from "@/lib/admin.functions";
import { daysUntil, severityFromDays, severityColor } from "@/lib/expiry";

type Row = {
  id: string;
  user_id: string;
  yaarsa_username: string;
  yaarsa_email: string;
  server_ip: string | null;
  panel: string | null;
  version_tier: string | null;
  plan_slug: string;
  is_legacy: boolean;
  revoked: boolean;
  paid_externally: boolean;
  paid_externally_until: string | null;
  paid_externally_marked_at: string | null;
  paid_externally_last_check_at: string | null;
  paid_externally_last_check_status: string | null;
  expires_at: string | null;
  server_paid_until: string | null;
  profile: { email: string; full_name: string | null } | null;
};

function nextDay20YMD(): string {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), 20);
  if (d.getDate() >= 20) t.setMonth(t.getMonth() + 1);
  return t.toISOString().slice(0, 10);
}

function formatRelative(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "agora";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function StatusPill({ row }: { row: Row }) {
  const s = row.paid_externally_last_check_status;
  if (!s) return <span className="rounded bg-muted/30 px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">sem check</span>;
  if (s === "aligned") return <span className="inline-flex items-center gap-1 rounded bg-neon/10 px-2 py-0.5 font-mono text-[10px] uppercase text-neon"><CheckCircle2 className="h-3 w-3" /> alinhado</span>;
  if (s === "expired") return <span className="inline-flex items-center gap-1 rounded bg-danger/10 px-2 py-0.5 font-mono text-[10px] uppercase text-danger"><XCircle className="h-3 w-3" /> venceu</span>;
  if (s.startsWith("yaarsa_fail")) return <span className="inline-flex items-center gap-1 rounded bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-400" title={s}><XCircle className="h-3 w-3" /> falha painel</span>;
  return <span className="rounded bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-400" title={s}>{s.slice(0, 14)}</span>;
}

export function AdminExternalPayersPanel() {
  const listExtFn = useServerFn(adminListExternalPayers);
  const listCandFn = useServerFn(adminListLegacyCandidates);
  const markFn = useServerFn(adminMarkPaidExternally);
  const unmarkFn = useServerFn(adminUnmarkPaidExternally);

  const [rows, setRows] = useState<Row[]>([]);
  const [candidates, setCandidates] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [ext, cand] = await Promise.all([listExtFn(), listCandFn()]);
      setRows((ext as any[]) as Row[]);
      setCandidates((cand as any[]) as Row[]);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar externos");
    } finally { setLoading(false); }
  }, [listExtFn, listCandFn]);

  useEffect(() => { void reload(); }, [reload]);

  const filteredCands = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return candidates;
    return candidates.filter((r) =>
      (r.profile?.email || "").toLowerCase().includes(term) ||
      (r.yaarsa_email || "").toLowerCase().includes(term) ||
      (r.yaarsa_username || "").toLowerCase().includes(term));
  }, [candidates, q]);

  const setB = (id: string, v: boolean) => setBusy((b) => ({ ...b, [id]: v }));

  const onMark = async (id: string, untilDate?: string) => {
    setB(id, true);
    try {
      const r = await markFn({ data: { licenseId: id, ...(untilDate ? { untilDate } : {}) } });
      toast.success(`Marcado como pago fora até ${(r as any).until}`);
      await reload();
    } catch (e: any) { toast.error(e?.message || "Falha ao marcar"); }
    finally { setB(id, false); }
  };

  const onUnmark = async (id: string) => {
    setB(id, true);
    try {
      await unmarkFn({ data: { licenseId: id } });
      toast.success("Marcação removida");
      await reload();
    } catch (e: any) { toast.error(e?.message || "Falha ao remover"); }
    finally { setB(id, false); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="terminal-card scanlines relative p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-neon" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-neon">Pagam Por Fora</h2>
            </div>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Clientes antigos que pagam o servidor fora do site. Ao marcar,
              o sistema estende a licença no painel Yaarsa para o próximo dia 20.
              Uma rotina automática verifica <span className="text-neon">a cada 3 dias</span> se o painel continua
              alinhado — se houver drift, ela reforça a data sozinha.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={reload} disabled={loading} className="font-mono uppercase tracking-wider">
            {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Ativos */}
      <div className="terminal-card scanlines relative p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-mono text-xs uppercase tracking-widest text-cyan">
            // Ativos <span className="text-muted-foreground">({rows.length})</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-neon" /> IA verifica a cada 3 dias
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="rounded border border-dashed border-border/50 bg-background/30 p-6 text-center text-xs text-muted-foreground">
            Nenhum cliente marcado como pagador externo ainda. Use a lista abaixo para começar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-left font-mono text-[10px] uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Login Yaarsa</th>
                  <th className="py-2 pr-3">Painel</th>
                  <th className="py-2 pr-3">Cobre até</th>
                  <th className="py-2 pr-3">Último check</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const days = daysUntil(r.paid_externally_until ? `${r.paid_externally_until}T23:59:59` : null);
                  const sev = severityFromDays(days);
                  const sc = severityColor(sev);
                  return (
                    <tr key={r.id} className="border-b border-border/20 hover:bg-background/40">
                      <td className="py-2 pr-3">
                        <div className="truncate font-mono text-[11px]">{r.profile?.email ?? "—"}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{r.profile?.full_name ?? ""}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-mono text-[11px] text-foreground">{r.yaarsa_username}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{r.yaarsa_email}</div>
                      </td>
                      <td className="py-2 pr-3 font-mono text-[10px] uppercase">
                        {r.panel === "v46" ? <span className="text-violet">4.6</span> : <span className="text-cyan">4.5.7</span>}
                      </td>
                      <td className={`py-2 pr-3 font-mono text-[11px] ${sc.text}`}>
                        {r.paid_externally_until ?? "—"}
                        {days !== null && (
                          <div className="text-[10px] text-muted-foreground">
                            {days < 0 ? `${Math.abs(days)}d atrás` : `em ${days}d`}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[10px] text-muted-foreground">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {formatRelative(r.paid_externally_last_check_at)}
                      </td>
                      <td className="py-2 pr-3"><StatusPill row={r} /></td>
                      <td className="py-2 pr-0">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => onMark(r.id)} disabled={busy[r.id]} className="h-7 font-mono text-[10px] uppercase" title="Reafirmar até o próximo dia 20">
                            <RefreshCw className={`mr-1 h-3 w-3 ${busy[r.id] ? "animate-spin" : ""}`} /> Renovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onUnmark(r.id)} disabled={busy[r.id]} className="h-7 font-mono text-[10px] uppercase text-danger hover:text-danger">
                            Remover
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Candidatos: legacy que ainda não estão marcados */}
      <div className="terminal-card scanlines relative p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-xs uppercase tracking-widest text-violet">
            // Clientes Antigos disponíveis <span className="text-muted-foreground">({filteredCands.length})</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar por email / login" className="h-8 w-64 pl-7 font-mono text-xs" />
          </div>
        </div>
        {filteredCands.length === 0 ? (
          <div className="rounded border border-dashed border-border/50 bg-background/30 p-6 text-center text-xs text-muted-foreground">
            Nenhum cliente antigo pendente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-left font-mono text-[10px] uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Login Yaarsa</th>
                  <th className="py-2 pr-3">Painel</th>
                  <th className="py-2 pr-3">Expira</th>
                  <th className="py-2 pr-0 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredCands.map((r) => (
                  <tr key={r.id} className="border-b border-border/20 hover:bg-background/40">
                    <td className="py-2 pr-3">
                      <div className="truncate font-mono text-[11px]">{r.profile?.email ?? "—"}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{r.profile?.full_name ?? ""}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-mono text-[11px]">{r.yaarsa_username}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{r.yaarsa_email}</div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-[10px] uppercase">
                      {r.panel === "v46" ? <span className="text-violet">4.6</span> : <span className="text-cyan">4.5.7</span>}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[10px] text-muted-foreground">
                      {r.expires_at ? new Date(r.expires_at).toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <Button size="sm" onClick={() => onMark(r.id, nextDay20YMD())} disabled={busy[r.id]} className="h-7 bg-neon/20 font-mono text-[10px] uppercase text-neon hover:bg-neon/30">
                        {busy[r.id] ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ExternalLink className="mr-1 h-3 w-3" />}
                        Pagou fora → estender p/ dia 20
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
