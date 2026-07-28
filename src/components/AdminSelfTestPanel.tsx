import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, PlayCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runPurchaseSelfTest, type SelfTestStep } from "@/lib/selftest.functions";

export function AdminSelfTestPanel() {
  const run = useServerFn(runPurchaseSelfTest);
  const [loading, setLoading] = useState<"safe" | "full" | null>(null);
  const [steps, setSteps] = useState<SelfTestStep[] | null>(null);
  const [mode, setMode] = useState<string>("");
  const [confirmFull, setConfirmFull] = useState(false);

  async function execute(m: "safe" | "full") {
    if (loading) return;
    setLoading(m);
    setSteps(null);
    try {
      const res = await run({ data: { mode: m, planSlug: "login-30d" } });
      setSteps(res.steps);
      setMode(res.mode);
      const failed = res.steps.filter((s) => !s.ok).length;
      if (failed === 0) toast.success("Autoteste concluído sem falhas");
      else toast.error(`${failed} etapa(s) com problema`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao executar o autoteste");
    } finally {
      setLoading(null);
      setConfirmFull(false);
    }
  }

  const failed = steps?.filter((s) => !s.ok).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-mono text-sm font-semibold">Autoteste de compra (PIX)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Verificação: checa Mercado Pago, painéis Yaarsa, criptografia, códigos de recuperação e storage — sem alterar nada.
          Simulação completa: cria um pedido de teste, executa a mesma entrega do webhook de PIX aprovado, confere licença e
          credenciais no chat e depois revoga tudo que foi gerado.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => execute("safe")} disabled={loading !== null}>
            {loading === "safe" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Rodar verificação
          </Button>
          {!confirmFull ? (
            <Button size="sm" variant="outline" onClick={() => setConfirmFull(true)} disabled={loading !== null}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              Simulação completa
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Cria conta real no painel e revoga depois. Confirmar?</span>
              <Button size="sm" variant="destructive" onClick={() => execute("full")} disabled={loading !== null}>
                {loading === "full" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sim, executar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmFull(false)} disabled={loading !== null}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </div>

      {steps && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-muted-foreground">
              Resultado — modo {mode === "full" ? "simulação completa" : "verificação"}
            </span>
            <span className={`font-mono text-xs ${failed ? "text-destructive" : "text-primary"}`}>
              {failed ? `${failed} falha(s)` : "tudo ok"}
            </span>
          </div>
          <ul className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 rounded border border-border/60 p-3">
                {s.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0">
                  <p className="font-mono text-sm">{s.step}</p>
                  <p className="break-words text-xs text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
