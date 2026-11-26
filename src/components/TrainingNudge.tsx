import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { GraduationCap, ArrowRight, X, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Empurrãozinho para a Central de Treinamento logo depois que o cliente
 * ativa uma licença (resgate de código OU compra nova). Aparece só quando
 * existe uma licença ATIVA criada nas últimas 72h — o mesmo gatilho serve
 * para os dois caminhos sem precisar de coluna nova no banco.
 *
 * É dispensável e lembrado por licença no navegador, então não insiste:
 * quem já fechou (ou já entrou na Central) não vê de novo para aquela licença.
 */
const FRESH_WINDOW_MS = 72 * 60 * 60 * 1000;

export function TrainingNudge({
  licenses,
  serverNow,
}: {
  licenses?: any[];
  serverNow: number;
}) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Licença ativa mais recente dentro da janela de "acabou de ativar".
  // Ignora teste grátis: o teste já tem seu próprio fluxo de boas-vindas.
  const fresh = (licenses ?? [])
    .filter((l: any) => {
      if (l.is_trial || l.disabled_at || l.suspended_at) return false;
      const createdMs = l.created_at ? new Date(l.created_at).getTime() : NaN;
      if (!Number.isFinite(createdMs)) return false;
      const age = serverNow - createdMs;
      return age >= 0 && age <= FRESH_WINDOW_MS;
    })
    .sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];

  const key = fresh ? `shadow:training-nudge:${fresh.id}` : null;

  // SSR-safe: só decide exibir depois de montar, para não divergir no hidrate.
  useEffect(() => {
    if (!key) {
      setReady(false);
      return;
    }
    try {
      setDismissed(!!localStorage.getItem(key));
    } catch {
      setDismissed(false);
    }
    setReady(true);
  }, [key]);

  const close = () => {
    setDismissed(true);
    if (key) {
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* sem storage — tudo bem, some só nesta sessão */
      }
    }
  };

  if (!ready || !fresh || dismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 shadow-[0_18px_60px_-45px_var(--primary)] animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <button
        type="button"
        onClick={close}
        aria-label="Dispensar aviso da Central de Treinamento"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-primary/10 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-primary/80">
            <PlayCircle className="h-3 w-3" />
            Primeiro acesso
          </p>
          <h3 className="mt-1 text-base font-bold text-foreground">
            Licença ativa! Já viu a Central de Treinamento?
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Vídeos passo a passo pra configurar tudo do jeito certo na primeira vez —
            instalação, login, bypass e as funções exclusivas. É o caminho mais rápido
            pra não travar em nada.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Button size="sm" asChild className="font-semibold">
            <Link to="/tutoriais" onClick={close}>
              Abrir Central
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <button
            type="button"
            onClick={close}
            className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Depois
          </button>
        </div>
      </div>
    </div>
  );
}
