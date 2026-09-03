import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySecurityPin, rotateMySecurityPin } from "@/lib/security-pin.functions";
import { Button } from "@/components/ui/button";
import { Copy, Eye, EyeOff, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * PIN de segurança do cliente. A equipe só consegue ver os dados de login das
 * licenças informando este PIN — e ele é trocado a cada uso.
 */
export function SecurityPinCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [show, setShow] = useState(false);
  const [rotating, setRotating] = useState(false);
  const qc = useQueryClient();
  const pinFn = useServerFn(getMySecurityPin);
  const rotateFn = useServerFn(rotateMySecurityPin);

  const { data, isLoading } = useQuery({
    queryKey: ["my-security-pin"],
    queryFn: () => pinFn({}),
    staleTime: 60_000,
  });

  const pin = (data as any)?.pin as string | null | undefined;

  async function rotate() {
    setRotating(true);
    try {
      await rotateFn({});
      await qc.invalidateQueries({ queryKey: ["my-security-pin"] });
      toast.success("Novo PIN gerado. O anterior não vale mais.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar um novo PIN agora.");
    }
    setRotating(false);
  }

  function copy() {
    if (!pin) return;
    navigator.clipboard.writeText(pin).then(
      () => toast.success("PIN copiado"),
      () => toast.error("Não consegui copiar"),
    );
  }

  const masked = "••••-••••";

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1",
          className,
        )}
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">PIN</span>
        <span className="font-mono text-xs tabular-nums">
          {isLoading ? "…" : show ? (pin ?? "—") : masked}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={show ? "Ocultar PIN" : "Mostrar PIN"}
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
        {show && pin && (
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Copiar PIN" onClick={copy}>
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-primary/30 bg-card/60 p-4", className)}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">PIN de segurança</h3>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Nenhum atendente vê o e-mail e a senha do seu login sem este PIN. Só informe quando{" "}
        <span className="font-semibold text-foreground">você</span> pedir ajuda com o acesso. A cada uso
        ele é trocado automaticamente por um novo.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 font-mono text-lg tracking-[0.2em] tabular-nums">
          {isLoading ? "…" : show ? (pin ?? "—") : masked}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => setShow((v) => !v)}>
          {show ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
          {show ? "Ocultar" : "Mostrar"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!pin} onClick={copy}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={rotating} onClick={rotate}>
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", rotating && "animate-spin")} /> Gerar novo
        </Button>
      </div>

      {(data as any)?.lastUsedAt && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Última consulta da equipe com PIN: {new Date((data as any).lastUsedAt).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}
