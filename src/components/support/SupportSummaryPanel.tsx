import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { summarizeThread, escalateThread, type ThreadSummary } from "@/lib/support-summary.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ClipboardList,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  LifeBuoy,
  Hash,
  ListChecks,
  FileSearch,
} from "lucide-react";

/**
 * Resumo estruturado do atendimento: diagnóstico, evidências, protocolo e
 * próximos passos — com encaminhamento para a equipe humana quando há
 * bloqueio ou erro de sistema.
 */
export function SupportSummaryPanel({ threadId }: { threadId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [summary, setSummary] = useState<ThreadSummary | null>(null);

  const summarize = useServerFn(summarizeThread);
  const escalate = useServerFn(escalateThread);

  const generate = async () => {
    setLoading(true);
    try {
      const r = (await summarize({ data: { threadId } })) as ThreadSummary;
      setSummary(r);
      setOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar o resumo.");
    } finally {
      setLoading(false);
    }
  };

  const doEscalate = async () => {
    setEscalating(true);
    try {
      const r: any = await escalate({
        data: { threadId, reason: summary?.diagnosis?.slice(0, 400) },
      });
      toast.success(`Encaminhado para o suporte. Protocolo ${r.protocol}`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao encaminhar para o suporte.");
    } finally {
      setEscalating(false);
    }
  };

  return (
    <div className="border-b border-border/40 bg-background/30">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-[11px] font-mono uppercase tracking-wide"
          onClick={() => (summary ? setOpen((v) => !v) : generate())}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ClipboardList className="h-3.5 w-3.5" />
          )}
          Resumo do atendimento
          {summary && (open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </Button>

        {summary?.protocol && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            <Hash className="h-3 w-3" /> {summary.protocol}
          </span>
        )}
      </div>

      {open && summary && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-3 px-3 sm:px-4 pb-3 text-xs">
          <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <FileSearch className="h-3 w-3" /> Diagnóstico
            </p>
            <p className="leading-relaxed">{summary.diagnosis}</p>
          </div>

          {summary.evidence.length > 0 && (
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Evidências ({summary.evidence.length})
              </p>
              <ul className="space-y-1">
                {summary.evidence.map((e, i) => (
                  <li key={i} className="text-muted-foreground leading-relaxed">
                    • {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <ListChecks className="h-3 w-3" /> Próximos passos
            </p>
            <ol className="space-y-1 list-decimal list-inside">
              {summary.nextSteps.map((s, i) => (
                <li key={i} className="leading-relaxed">
                  {s}
                </li>
              ))}
            </ol>
          </div>

          {summary.blocked && (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 sm:flex-row sm:items-center">
              <p className="flex flex-1 items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Detectamos um bloqueio ou erro de sistema nesta conversa.
              </p>
              <Button size="sm" className="h-8 gap-1.5" onClick={doEscalate} disabled={escalating}>
                {escalating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LifeBuoy className="h-3.5 w-3.5" />}
                Encaminhar para o suporte
              </Button>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full text-[10px] uppercase font-mono"
            onClick={generate}
            disabled={loading}
          >
            Atualizar resumo
          </Button>
        </div>
      )}
    </div>
  );
}
