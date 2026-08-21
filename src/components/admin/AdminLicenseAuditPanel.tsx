import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, ScrollText, Search, KeyRound, RefreshCcwDot, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { staffListLicenseAudit } from "@/lib/license-audit.functions";

/** Rótulos amigáveis para cada tipo de alteração registrada. */
const EVENT_META: Record<string, { label: string; icon: typeof KeyRound; tone: string }> = {
  password_change: { label: "Troca de senha", icon: KeyRound, tone: "text-amber-400 border-amber-500/40" },
  panel_sync_activate: { label: "Sincronização Yaarsa", icon: RefreshCcwDot, tone: "text-cyan-400 border-cyan-500/40" },
  coupon_license_days: { label: "Cupom — dias de licença", icon: Ticket, tone: "text-emerald-400 border-emerald-500/40" },
  coupon_server_renewal: { label: "Cupom — servidor", icon: Ticket, tone: "text-violet-400 border-violet-500/40" },
};

const FILTERS = [
  { id: "all", label: "Tudo" },
  { id: "password_change", label: "Senhas" },
  { id: "panel_sync_activate", label: "Sincronizações" },
  { id: "coupon_license_days", label: "Cupons (dias)" },
  { id: "coupon_server_renewal", label: "Cupons (servidor)" },
];

const fmt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const fmtDay = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

/**
 * Histórico de auditoria: mostra quando cada licença/login foi alterado,
 * por quem e por qual motivo (senha, sincronização com o painel ou cupom).
 */
export function AdminLicenseAuditPanel() {
  const listFn = useServerFn(staffListLicenseAudit);

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("all");

  const load = useCallback(
    async (opts?: { search?: string; eventType?: string }) => {
      setLoading(true);
      try {
        const res: any = await listFn({
          data: {
            search: (opts?.search ?? search).trim() || undefined,
            eventType: opts?.eventType ?? eventType,
            limit: 150,
          },
        });
        if (res?.ok === false) throw new Error(res.message ?? "Falha ao carregar histórico.");
        setEvents(res?.events ?? []);
      } catch (e: any) {
        toast.error(e?.message ?? "Não foi possível carregar o histórico agora.");
      } finally {
        setLoading(false);
      }
    },
    [listFn, search, eventType],
  );

  useEffect(() => { void load({ eventType: "all", search: "" }); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Auditoria de licenças & logins
          </h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
            placeholder="Buscar pelo e-mail do login (Yaarsa)…"
            className="pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setEventType(f.id); void load({ eventType: f.id }); }}
              className={`rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                eventType === f.id
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-border/50 bg-background/40">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-background/30 p-8 text-center text-xs text-muted-foreground">
          Nenhuma alteração registrada com esse filtro ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => {
            const meta = EVENT_META[ev.event_type] ?? {
              label: ev.event_type, icon: ScrollText, tone: "text-muted-foreground border-border/60",
            };
            const Icon = meta.icon;
            const actorName =
              ev.actor?.display_name || ev.actor?.email ||
              (ev.actor_kind === "system" ? "Sistema" : ev.actor_kind === "webhook" ? "Pagamento" : "—");
            return (
              <div
                key={ev.id}
                className="rounded-lg border border-border/50 bg-background/40 p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${meta.tone}`}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{fmt(ev.created_at)}</span>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    por {actorName} · {ev.actor_kind}
                  </span>
                </div>

                <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                  <p className="text-foreground">
                    <span className="text-muted-foreground">Login: </span>
                    {ev.yaarsa_email ?? "—"}
                    {ev.panel ? <span className="text-muted-foreground"> ({ev.panel})</span> : null}
                  </p>
                  <p className="text-foreground">
                    <span className="text-muted-foreground">Cliente: </span>
                    {ev.owner?.display_name || ev.owner?.email || "—"}
                  </p>
                  <p className="text-muted-foreground sm:col-span-2">
                    <span className="text-muted-foreground">Motivo: </span>
                    <span className="text-foreground">{ev.reason ?? "—"}</span>
                  </p>
                  {(ev.expires_before || ev.expires_after) && (
                    <p className="text-muted-foreground sm:col-span-2">
                      Vencimento: <span className="text-foreground">{fmtDay(ev.expires_before)}</span> →{" "}
                      <span className="text-primary">{fmtDay(ev.expires_after)}</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
