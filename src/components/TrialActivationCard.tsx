import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateTrial } from "@/lib/license.functions";
import { getDeviceSignature } from "@/lib/device-signature";

type TrialResult = {
  username: string;
  email: string;
  password: string;
  server_ip?: string | null;
  expires_at?: string | null;
};

/**
 * Cartão de ativação do teste grátis de 24h.
 * Aparece somente para quem ainda não tem nenhuma licença ativa.
 */
export function TrialActivationCard({ onDone }: { onDone?: () => void }) {
  const run = useServerFn(generateTrial);
  const [loading, setLoading] = useState(false);
  const [creds, setCreds] = useState<TrialResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setLoading(true);
    setError(null);
    try {
      const res = (await run({ data: getDeviceSignature() })) as TrialResult;
      setCreds(res);
      toast.success("Teste grátis ativado! Você tem 24 horas.");
      onDone?.();
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "Falha ao gerar o teste").replace(/^Error:\s*/, "");
      setError(msg);
      toast.error("Não foi possível gerar o teste", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="enterprise-surface overflow-hidden" aria-labelledby="trial-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
        <div>
          <h2 id="trial-title" className="font-mono text-sm font-bold uppercase">Teste grátis de 24 horas</h2>
          <p className="mt-1 text-xs text-muted-foreground">Um teste por pessoa · credenciais liberadas na hora</p>
        </div>
        <Gift className="h-5 w-5 text-primary" />
      </div>
      <div className="space-y-3 p-5">
        {!creds && (
          <>
            <p className="text-sm text-muted-foreground">
              Ative agora e receba um login válido por 24 horas exatas. Quando o contador zerar, o acesso é encerrado automaticamente.
            </p>
            <Button onClick={() => void activate()} disabled={loading} className="font-mono text-[10px] uppercase">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
              {loading ? "Gerando seu teste…" : "Ativar teste grátis"}
            </Button>
            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
            )}
          </>
        )}
        {creds && (
          <div className="space-y-1.5 rounded-md border border-border/60 bg-background/60 p-3 font-mono text-xs">
            {[
              { label: "Usuário", value: creds.username },
              { label: "E-mail", value: creds.email },
              { label: "Senha", value: creds.password },
              { label: "Servidor", value: creds.server_ip || "—" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{row.label}</span>
                <button
                  type="button"
                  className="flex items-center gap-1.5 truncate text-foreground hover:text-primary"
                  onClick={() => { navigator.clipboard.writeText(String(row.value ?? "")); toast.success("Copiado!"); }}
                >
                  <span className="truncate">{row.value}</span>
                  <Copy className="h-3 w-3 shrink-0" />
                </button>
              </div>
            ))}
            <p className="pt-1 text-[10px] normal-case text-muted-foreground">
              Salve estes dados. Seu teste dura 24 horas a partir de agora.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
