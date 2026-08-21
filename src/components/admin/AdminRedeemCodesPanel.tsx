import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, Plus, RefreshCw, Ticket, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  staffCreateRedeemCodes,
  staffListRedeemCodes,
  staffToggleRedeemCode,
} from "@/lib/redeem-codes.functions";
import { adminSyncLicensesFromPanel } from "@/lib/admin.functions";

/**
 * Central de cortesias da equipe.
 * - Gera códigos de licença (3d, 7d, 30d…) e de renovação de servidor.
 * - Reconcilia com o painel Yaarsa: reativa quem já está liberado por lá.
 */
export function AdminRedeemCodesPanel() {
  const listFn = useServerFn(staffListRedeemCodes);
  const createFn = useServerFn(staffCreateRedeemCodes);
  const toggleFn = useServerFn(staffToggleRedeemCode);
  const syncFn = useServerFn(adminSyncLicensesFromPanel);

  const [data, setData] = useState<{ codes: any[]; uses: any[] }>({ codes: [], uses: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<any>(null);

  const [kind, setKind] = useState<"license_days" | "server_renewal">("license_days");
  const [days, setDays] = useState(7);
  const [planSlug, setPlanSlug] = useState("login-30d");
  const [quantity, setQuantity] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [validForDays, setValidForDays] = useState(30);
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setData((await listFn()) as any);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar os códigos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const res: any = await createFn({
        data: {
          kind,
          ...(kind === "license_days" ? { days, planSlug: planSlug as any } : {}),
          quantity,
          maxUses,
          validForDays,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      toast.success(`${res.codes.length} código(s) gerado(s).`);
      setNote("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar os códigos.");
    } finally {
      setBusy(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const res: any = await syncFn({ data: { onlyInactive: true, limit: 60 } });
      setSyncReport(res);
      toast.success(
        `Conferidas ${res.checked} licença(s): ${res.activated} reativada(s) pela data do painel.`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao sincronizar com o painel.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border/60 bg-background/40 p-4">
        <h3 className="mb-1 font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
          Gerar código de cortesia
        </h3>
        <p className="mb-3 font-mono text-[10px] text-muted-foreground">
          O cliente resgata no painel dele. Código de servidor pede que ele escolha qual login
          será adiantado para o próximo dia 20.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Tipo</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-xs"
            >
              <option value="license_days">Dias de licença</option>
              <option value="server_renewal">Renovação de servidor (dia 20)</option>
            </select>
          </label>

          {kind === "license_days" && (
            <>
              <label className="space-y-1">
                <span className="font-mono text-[10px] uppercase text-muted-foreground">Dias</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="font-mono"
                />
              </label>
              <label className="space-y-1">
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  Plano (se criar login novo)
                </span>
                <select
                  value={planSlug}
                  onChange={(e) => setPlanSlug(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-xs"
                >
                  <option value="login-7d">Semanal · v4.5.5</option>
                  <option value="login-30d">Mensal · v4.5.7</option>
                  <option value="login-lifetime">Vitalício · v4.6</option>
                </select>
              </label>
            </>
          )}

          <label className="space-y-1">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Quantidade</span>
            <Input type="number" min={1} max={50} value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))} className="font-mono" />
          </label>
          <label className="space-y-1">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Usos por código</span>
            <Input type="number" min={1} max={500} value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))} className="font-mono" />
          </label>
          <label className="space-y-1">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Vale por (dias)</span>
            <Input type="number" min={1} max={365} value={validForDays}
              onChange={(e) => setValidForDays(Number(e.target.value))} className="font-mono" />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Observação</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="ex.: compensação pelo atraso do dia 20" className="font-mono" />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={create} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Gerar
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-background/40 p-4">
        <h3 className="mb-1 font-mono text-[11px] font-bold uppercase tracking-widest text-cyan">
          Sincronizar com o painel Yaarsa
        </h3>
        <p className="mb-3 font-mono text-[10px] text-muted-foreground">
          Lê a data real de cada login inativo no painel. Se a data já está no futuro (você
          corrigiu na mão), o site reativa a licença e conserta a contagem de dias. Se a data
          está vencida, nada muda — o servidor realmente não foi pago.
        </p>
        <Button variant="outline" onClick={runSync} disabled={syncing}>
          {syncing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Reconciliar inativas
        </Button>
        {syncReport && (
          <div className="mt-3 space-y-1 font-mono text-[10px] text-muted-foreground">
            <div>
              conferidas {syncReport.checked} · reativadas {syncReport.activated} · sem mudança{" "}
              {syncReport.unchanged} · sem leitura {syncReport.unknown}
            </div>
            {(syncReport.items ?? []).slice(0, 20).map((i: any) => (
              <div key={i.license_id} className="truncate">
                {i.yaarsa_email} → {i.action} ({i.reason})
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
          Códigos ({data.codes.length})
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> carregando…
          </div>
        ) : data.codes.length === 0 ? (
          <p className="font-mono text-[11px] text-muted-foreground">Nenhum código gerado ainda.</p>
        ) : (
          <div className="space-y-2">
            {data.codes.map((c: any) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/40 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono text-sm font-bold tracking-wider">{c.code}</span>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(c.code);
                        toast.success("Código copiado.");
                      }}
                      className="text-muted-foreground hover:text-primary"
                      aria-label="Copiar código"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {c.kind === "server_renewal" ? "renovação de servidor" : `${c.days} dia(s) · ${c.plan_slug}`}
                    {" · "}usos {c.uses}/{c.max_uses}
                    {c.expires_at ? ` · vence ${new Date(c.expires_at).toLocaleDateString("pt-BR")}` : ""}
                    {c.note ? ` · ${c.note}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={c.active ? "outline" : "secondary"}
                  onClick={async () => {
                    try {
                      await toggleFn({ data: { id: c.id, active: !c.active } });
                      await load();
                    } catch (e: any) {
                      toast.error(e?.message ?? "Falha ao atualizar.");
                    }
                  }}
                >
                  <Power className="mr-1.5 h-3.5 w-3.5" />
                  {c.active ? "Desativar" : "Reativar"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.uses.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-violet">
            Últimos resgates
          </h3>
          {data.uses.slice(0, 20).map((u: any) => (
            <div key={u.id} className="font-mono text-[10px] text-muted-foreground">
              {new Date(u.created_at).toLocaleString("pt-BR")} · {u.code} · licença{" "}
              {String(u.license_id ?? "—").slice(0, 8)}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
