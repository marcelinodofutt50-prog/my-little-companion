import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Copy, Loader2, ServerCog, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMyMigrationWave, claimMigrationWave } from "@/lib/migration-wave.functions";
import { toast } from "sonner";

const PANEL_LABEL: Record<string, string> = { v455: "4.5.5", v457: "4.5.7", v46: "4.6" };

function hoursLeft(deadline: string) {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 3600_000));
}

export function MigrationWaveCard() {
  const qc = useQueryClient();
  const getWave = useServerFn(getMyMigrationWave);
  const claim = useServerFn(claimMigrationWave);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creds, setCreds] = useState<
    { username: string; email: string; password: string; server_ip: string }[] | null
  >(null);

  const { data } = useQuery({
    queryKey: ["migration-wave"],
    queryFn: () => getWave(),
    refetchInterval: 5 * 60_000,
  });

  if (!data) return null;
  const { wave, pending, alreadyMigrated } = data;
  const left = hoursLeft(wave.deadlineAt);
  const urgent = left <= 12;

  if (pending.length === 0 && alreadyMigrated && !creds) {
    return (
      <Card className="mb-4 border-neon/40 bg-background/60">
        <CardContent className="flex items-center gap-3 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-neon" />
          <p className="font-mono text-[11px] text-muted-foreground">
            Migração concluída. Seu login antigo do painel {PANEL_LABEL[wave.panel]} será revogado em{" "}
            <span className="text-foreground">{left}h</span> — use o login novo a partir de agora.
          </p>
        </CardContent>
      </Card>
    );
  }

  const doClaim = async () => {
    setLoading(true);
    try {
      const res = await claim({ data: { waveId: wave.id } });
      setCreds(res.credentials);
      toast.success("Login novo gerado com sucesso");
      qc.invalidateQueries({ queryKey: ["migration-wave"] });
      qc.invalidateQueries({ queryKey: ["licenses"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar o login novo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card
        className={`relative mb-4 overflow-hidden border bg-background/60 ${
          urgent ? "border-danger/60" : "border-amber-400/50"
        }`}
      >
        <div
          className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-10 blur-2xl ${
            urgent ? "bg-danger" : "bg-amber-400"
          }`}
        />
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`rounded-md p-1.5 ${
                urgent ? "bg-danger/10 text-danger" : "bg-amber-400/10 text-amber-400"
              }`}
            >
              <ServerCog className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold tracking-tight">{wave.title}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                Novo servidor do painel {PANEL_LABEL[wave.panel]}
                {wave.serverLabel ? ` · ${wave.serverLabel}` : ""} · gere seu login novo antes do
                prazo.
              </p>
              <p
                className={`mt-1 flex items-center gap-1 font-mono text-[11px] ${
                  urgent ? "text-danger" : "text-amber-400"
                }`}
              >
                <Timer className="h-3 w-3" />
                {left}h restantes — depois disso o login antigo é revogado.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className={`shrink-0 font-mono text-[11px] uppercase tracking-wider ${
              urgent ? "bg-danger hover:bg-danger/90" : "bg-amber-500 hover:bg-amber-500/90"
            }`}
          >
            Gerar login novo
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => !loading && setOpen(v)}>
        <DialogContent className="max-w-lg">
          {creds ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Login novo criado</DialogTitle>
                <DialogDescription className="font-mono text-[11px]">
                  Configure o app com estes dados. O login antigo para de funcionar em {left}h.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {creds.map((c) => (
                  <div key={c.email} className="rounded-md border border-border bg-muted/30 p-3">
                    <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                      {`user: ${c.username}\nemail: ${c.email}\npass: ${c.password}\nserver: ${c.server_ip}`}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 font-mono text-[10px] uppercase"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `user: ${c.username}\nemail: ${c.email}\npass: ${c.password}\nserver: ${c.server_ip}`,
                        );
                        toast.success("Copiado");
                      }}
                    >
                      <Copy className="mr-1.5 h-3 w-3" />
                      Copiar tudo
                    </Button>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => setOpen(false)} className="font-mono text-[11px] uppercase">
                  Entendi
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Antes de gerar seu login novo</DialogTitle>
                <DialogDescription className="font-mono text-[11px]">
                  Leia com atenção — depois do prazo o login antigo é revogado automaticamente.
                </DialogDescription>
              </DialogHeader>
              <ol className="space-y-2 font-mono text-[11px] text-muted-foreground">
                <li>
                  <span className="text-foreground">1.</span> Abra o painel antigo e{" "}
                  <span className="text-foreground">resuma / anote todos os seus clientes</span>.
                </li>
                <li>
                  <span className="text-foreground">2.</span> Faça backup do que precisar (listas,
                  configurações, arquivos) — nada é transferido sozinho.
                </li>
                <li>
                  <span className="text-foreground">3.</span> Gere o login novo aqui e recadastre
                  seus clientes no servidor novo.
                </li>
                <li>
                  <span className="text-foreground">4.</span> Você tem{" "}
                  <span className={urgent ? "text-danger" : "text-amber-400"}>{left} horas</span>.
                  Passado o prazo, o login antigo é revogado e o acesso ao servidor antigo acaba.
                </li>
              </ol>
              {wave.instructions ? (
                <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px] whitespace-pre-wrap">
                  {wave.instructions}
                </div>
              ) : null}
              <div className="flex items-start gap-1.5 rounded-md bg-danger/10 px-2 py-1.5 font-mono text-[10px] text-danger">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                Sua data de vencimento é mantida. O login antigo NÃO volta depois de revogado.
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="font-mono text-[11px] uppercase"
                >
                  Agora não
                </Button>
                <Button
                  onClick={doClaim}
                  disabled={loading}
                  className="font-mono text-[11px] uppercase"
                >
                  {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Gerar meu login novo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
