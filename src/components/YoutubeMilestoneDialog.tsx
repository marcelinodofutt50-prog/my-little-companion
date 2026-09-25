import { useEffect, useRef, useState } from "react";
import { X, Youtube, Gift, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Campanha de divulgação do canal do YouTube.
 * Bump no CAMPAIGN_ID sempre que a campanha mudar (reexibe para todos).
 */
const CAMPAIGN_ID = "yt-240-subs-v1";
const STORAGE_KEY = `shadow.campaign.${CAMPAIGN_ID}`;
const CHANNEL_URL = "https://www.youtube.com/@krebgulin";
const CURRENT = 240;
const GOAL = 300;

export function YoutubeMilestoneDialog() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      /* storage bloqueado: mostra mesmo assim */
    }
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open || firedRef.current) return;
    firedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const { default: confetti } = await import("canvas-confetti");
        if (cancelled) return;
        const colors = ["#22c55e", "#06b6d4", "#ffffff", "#facc15"];
        confetti({ particleCount: 140, spread: 78, origin: { y: 0.35 }, colors, zIndex: 100 });
        setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, colors, zIndex: 100 }), 220);
        setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors, zIndex: 100 }), 340);
      } catch {
        /* confete é decorativo */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function dismiss() {
    setClosing(true);
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setTimeout(() => setOpen(false), 180);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const pct = Math.min(100, Math.round((CURRENT / GOAL) * 100));

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm",
        closing ? "animate-fade-out" : "animate-fade-in",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Campanha do canal no YouTube"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        className={cn(
          "relative w-full max-w-lg overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl",
          closing ? "animate-scale-out" : "animate-scale-in",
        )}
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-20 h-8 w-8 rounded-full border border-border/60 bg-background/70 text-muted-foreground flex items-center justify-center transition-colors hover:text-foreground hover:border-primary/40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative z-10 p-6 sm:p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <Youtube className="h-7 w-7 text-primary" />
          </div>

          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Comunidade Shadow</p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight">
            Obrigado pelos <span className="text-primary">240 inscritos!</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            A Shadow está de cara nova e isso só é possível graças a você. Nos ajude a fazer o projeto crescer
            cada vez mais: se inscreva no canal e ative o sininho.
          </p>

          <div className="mt-6 rounded-xl border border-border/60 bg-background/50 p-4 text-left">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> {CURRENT} inscritos
              </span>
              <span className="text-primary font-bold">Meta {GOAL}</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Gift className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Ao bater <span className="font-bold text-foreground">300 inscritos</span> vamos sortear{" "}
                <span className="font-bold text-foreground">3 licenças de 1 mês</span> entre membros aleatórios do
                site. Faltam <span className="font-bold text-primary">{GOAL - CURRENT}</span> inscritos.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <Button asChild className="flex-1 font-bold">
              <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" onClick={dismiss}>
                Inscrever-se no canal <ArrowRight className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" className="sm:w-auto" onClick={dismiss}>
              Agora não
            </Button>
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            O sorteio será anunciado no painel e no canal quando a meta for atingida.
          </p>
        </div>
      </div>
    </div>
  );
}
