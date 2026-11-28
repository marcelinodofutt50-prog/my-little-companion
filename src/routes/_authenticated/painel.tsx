import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { myGangstarAccess } from "@/lib/gangstar.functions";

export const Route = createFileRoute("/_authenticated/painel")({
  ssr: false,
  component: PainelGangstar,
});

function PainelGangstar() {
  const check = useServerFn(myGangstarAccess);
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    let active = true;
    check()
      .then((r: any) => { if (active) setState(r?.hasAccess ? "ok" : "denied"); })
      .catch(() => { if (active) setState("denied"); });
    return () => { active = false; };
  }, [check]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando seu painel…
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-foreground">Acesso exclusivo Gangstar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este painel é liberado para quem ativou a Gangstar Remote. Se você já comprou e está vendo isto,
          fale com o suporte para liberar seu acesso.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <Link to="/suporte">Falar com o suporte</Link>
          </Button>
          <Button asChild>
            <Link to="/gangstar-remote">Ver a Gangstar Remote</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 bg-card/60 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Painel Gangstar
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
      </div>
      <iframe
        src="/api/gp/"
        title="Painel Gangstar"
        className="min-h-0 flex-1 border-0"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
