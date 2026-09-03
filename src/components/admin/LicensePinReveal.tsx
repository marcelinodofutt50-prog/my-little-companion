import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { staffRevealLicenseAccess, adminListPinReveals } from "@/lib/security-pin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, KeyRound, Loader2, ShieldAlert, History } from "lucide-react";
import { toast } from "sonner";

const d = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

function Copyable({ label, value }: { label: string; value: string | null }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-2 rounded border border-border/60 bg-background/60 px-2 py-1 text-left"
      onClick={() => {
        if (!value) return;
        navigator.clipboard.writeText(value).then(
          () => toast.success(`${label} copiado`),
          () => toast.error("Não consegui copiar"),
        );
      }}
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-[11px]">{value ?? "—"}</span>
      <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
    </button>
  );
}

/**
 * Acesso protegido por PIN: a equipe só vê e-mail e senha do painel depois que
 * o cliente informar o PIN atual dele (que é queimado no ato).
 */
export function LicensePinReveal({ userId }: { userId: string }) {
  const revealFn = useServerFn(staffRevealLicenseAccess);
  const logsFn = useServerFn(adminListPinReveals);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[] | null>(null);

  async function reveal(useChatGrant = false) {
    if (!useChatGrant && pin.replace(/[^A-Za-z0-9]/g, "").length < 4) {
      setError("Digite o PIN que o cliente informou.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res: any = await revealFn({ data: { userId, pin: useChatGrant ? "" : pin } });
      if (!res.ok) {
        setRows(null);
        setError(res.message);
      } else {
        setRows(res.licenses ?? []);
        setPin("");
        toast.success("Acessos liberados. O PIN do cliente já foi renovado.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Falha ao consultar os acessos.");
    }
    setLoading(false);
  }

  async function loadLogs() {
    try {
      const res: any = await logsFn({ data: { userId } });
      setLogs(res.reveals ?? []);
    } catch {
      setLogs([]);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        Acessos protegidos por PIN
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Peça o PIN de segurança ao cliente (ele fica no Shadow Pass e no cantinho do chat).
        Cada consulta é registrada e o PIN é trocado na hora.
      </p>

      <div className="flex gap-2">
        <Input
          value={pin}
          onChange={(e) => setPin(e.target.value.toUpperCase())}
          placeholder="PIN do cliente (ex.: ABCD-2345)"
          className="h-8 font-mono text-xs tracking-widest"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void reveal();
            }
          }}
        />
        <Button size="sm" className="h-8" disabled={loading} onClick={() => void reveal()}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
          <span className="ml-1.5 text-[11px]">Revelar</span>
        </Button>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-7 w-full text-[11px]"
        disabled={loading}
        onClick={() => void reveal(true)}
      >
        <KeyRound className="mr-1.5 h-3 w-3" /> O cliente já enviou o PIN no chat
      </Button>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {rows && (
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-[11px] text-muted-foreground">Esse cliente não tem licenças.</p>}
          {rows.map((l) => (
            <div key={l.id} className="space-y-1 rounded-lg border border-border/60 bg-card/60 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {l.planSlug} · {l.panel}
                </span>
                <Badge variant={l.active ? "default" : "secondary"} className="text-[10px]">
                  {l.active ? "ativa" : "inativa"}
                </Badge>
              </div>
              <Copyable label="Login" value={l.email} />
              <Copyable label="Senha" value={l.password} />
              <div className="text-[10px] text-muted-foreground">vence {d(l.expiresAt)}</div>
            </div>
          ))}
        </div>
      )}

      <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => void loadLogs()}>
        <History className="mr-1.5 h-3 w-3" /> Ver histórico de consultas
      </Button>
      {logs && (
        <ul className="space-y-1">
          {logs.length === 0 && <li className="text-[11px] text-muted-foreground">Nenhuma consulta registrada.</li>}
          {logs.map((r) => (
            <li key={r.id} className="rounded border border-border/50 bg-background/40 px-2 py-1 text-[10px]">
              {d(r.created_at)} · {r.staff_email ?? "equipe"} ·{" "}
              <span className={r.success ? "text-primary" : "text-destructive"}>
                {r.success ? "liberado" : "PIN recusado"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
