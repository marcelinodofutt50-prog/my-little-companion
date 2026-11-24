import { Link } from "@tanstack/react-router";
import { Clock, TrendingUp, BadgeCheck, Lock } from "lucide-react";

/** Trust pillars for the plans page — honest, calm, no fabricated urgency. */
export function ConversionBoosters() {
  return (
    <section className="mb-8 grid gap-3 md:grid-cols-3">
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5">
        <Lock className="h-5 w-5 shrink-0 text-neon" />
        <div className="min-w-0">
          <div className="font-mono text-xs font-bold text-foreground">Pagamento oficial</div>
          <div className="font-mono text-[10px] text-muted-foreground">PIX, cartão ou cripto — não guardamos seu cartão</div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5">
        <BadgeCheck className="h-5 w-5 shrink-0 text-cyan" />
        <div className="min-w-0">
          <div className="font-mono text-xs font-bold text-foreground">Garantia de 7 dias</div>
          <div className="font-mono text-[10px] text-muted-foreground">se a licença falhar, reembolso de 100%</div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5">
        <Clock className="h-5 w-5 shrink-0 text-violet" />
        <div className="min-w-0">
          <div className="font-mono text-xs font-bold text-foreground">Ativação rápida</div>
          <div className="font-mono text-[10px] text-muted-foreground">login liberado no painel em minutos</div>
        </div>
      </div>
    </section>
  );
}

/** Sticky mobile CTA. */
export function MobileStickyCTA({ label = "Ver planos", to = "/planos" as const }: { label?: string; to?: "/planos" | "/suporte" }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neon/40 bg-background/95 p-3 backdrop-blur md:hidden">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-5 w-5 flex-shrink-0 text-neon" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[11px] font-bold text-foreground">Comece agora</div>
          <div className="truncate font-mono text-[9px] text-muted-foreground">Ativação em segundos · garantia total</div>
        </div>
        <Link
          to={to}
          className="glow-neon flex-shrink-0 rounded-md bg-primary px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground"
        >
          {label}
        </Link>
      </div>
    </div>
  );
}
