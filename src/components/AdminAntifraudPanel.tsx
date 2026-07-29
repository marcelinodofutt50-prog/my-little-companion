import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { RefreshCw, ShieldAlert, Fingerprint, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSignupIpReport } from "@/lib/antifraud.read.functions";
import {
  allowSignupConnection,
  revokeSignupConnection,
} from "@/lib/antifraud.allow.functions";

const DAY_OPTIONS = [1, 7, 30, 90];

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded border border-border/60 bg-background/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-xl ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

export function AdminAntifraudPanel() {
  const fetchReport = useServerFn(getSignupIpReport);
  const allowFn = useServerFn(allowSignupConnection);
  const revokeFn = useServerFn(revokeSignupConnection);
  const [busyHash, setBusyHash] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [minAccounts, setMinAccounts] = useState(1);
  const [onlySuspicious, setOnlySuspicious] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-antifraud", days, minAccounts, onlySuspicious, search],
    queryFn: () =>
      fetchReport({ data: { days, minAccounts, onlySuspicious, search: search || undefined } }),
    refetchInterval: 120_000,
  });

  const rows = data?.rows ?? [];

  async function toggleAllow(ipHash: string, allowed: boolean) {
    if (busyHash) return;
    setBusyHash(ipHash);
    try {
      if (allowed) {
        await revokeFn({ data: { ipHash } });
        toast.success("Liberação removida — o limite volta a valer nesta conexão.");
      } else {
        await allowFn({ data: { ipHash, reason: "Liberado pelo admin no painel" } });
        toast.success("Conexão liberada — o cliente já pode criar a conta.");
      }
      await refetch();
    } catch {
      toast.error("Não foi possível atualizar a liberação.");
    } finally {
      setBusyHash(null);
    }
  }

  return (
    <div className="terminal-card scanlines relative p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-neon">
          <ShieldAlert className="h-3.5 w-3.5" /> Antifraude · cadastros por conexão
        </h3>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Registros" value={data?.total ?? 0} />
        <Stat
          label="Suspeitos"
          value={data?.suspiciousCount ?? 0}
          tone={(data?.suspiciousCount ?? 0) > 0 ? "text-amber-400" : "text-neon"}
        />
        <Stat label="Conexões únicas" value={data?.uniqueIps ?? 0} />
      </div>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                days === d
                  ? "border-neon/60 bg-neon/10 text-neon"
                  : "border-border/60 text-muted-foreground hover:text-neon"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground">
          Mín. tentativas
          <Input
            type="number"
            min={1}
            max={50}
            value={minAccounts}
            onChange={(e) => setMinAccounts(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="h-7 w-16 font-mono text-xs"
          />
        </label>

        <button
          onClick={() => setOnlySuspicious((v) => !v)}
          className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
            onlySuspicious
              ? "border-amber-400/60 bg-amber-400/10 text-amber-400"
              : "border-border/60 text-muted-foreground hover:text-amber-400"
          }`}
        >
          Só suspeitos
        </button>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="buscar e-mail ou hash"
          className="h-7 w-full max-w-[220px] font-mono text-xs"
        />
      </div>

      {/* Lista */}
      <div className="mt-4 space-y-2">
        {isLoading && (
          <p className="font-mono text-[11px] text-muted-foreground">Carregando registros...</p>
        )}
        {!isLoading && rows.length === 0 && (
          <p className="font-mono text-[11px] text-muted-foreground">
            Nenhum cadastro no filtro atual. Nada suspeito por aqui.
          </p>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 font-mono text-[11px] ${
              r.suspicious
                ? "border-amber-400/40 bg-amber-400/5"
                : "border-border/40 bg-background/40"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Fingerprint
                className={`h-3 w-3 shrink-0 ${r.suspicious ? "text-amber-400" : "text-muted-foreground"}`}
              />
              <span className="truncate text-foreground">{r.email_masked ?? "—"}</span>
              <span className="truncate text-muted-foreground">{r.ip_hash.slice(0, 12)}…</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className={r.accounts_in_window > 1 ? "text-amber-400" : undefined}>
                {r.accounts_in_window} conta(s)/{data?.config?.windowHours ?? 24}h
              </span>
              <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              <button
                onClick={() => toggleAllow(r.ip_hash, !!r.allowlisted)}
                disabled={busyHash === r.ip_hash}
                className={`flex items-center gap-1 rounded border px-2 py-0.5 uppercase tracking-wider transition disabled:opacity-50 ${
                  r.allowlisted
                    ? "border-neon/60 bg-neon/10 text-neon"
                    : "border-border/60 hover:text-neon"
                }`}
                title={
                  r.allowlisted
                    ? "Conexão liberada manualmente — clique para voltar ao limite normal"
                    : "Liberar esta conexão para o cliente conseguir criar conta"
                }
              >
                {r.allowlisted ? (
                  <>
                    <ShieldCheck className="h-3 w-3" /> Liberada
                  </>
                ) : (
                  <>
                    <ShieldX className="h-3 w-3" /> Liberar
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 font-mono text-[10px] text-muted-foreground">
        O IP nunca é armazenado em claro — apenas o hash com salt do servidor.
      </p>
      {data?.config && (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          Regra ativa: bloqueio acima de {data.config.maxAccounts} contas por conexão em{" "}
          {data.config.windowHours}h · marca suspeito acima de {data.config.suspiciousThreshold}.
          Ajustável por variável de ambiente, sem recompilar.
        </p>
      )}
    </div>
  );
}
