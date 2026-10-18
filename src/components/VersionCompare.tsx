import { Check, X, Crown, Layers } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useMoney } from "@/lib/currency";

type Row = { label: string; v457: React.ReactNode; v46: React.ReactNode; highlight?: boolean };

const yes = <Check className="mx-auto h-4 w-4 text-primary" />;
const no = <X className="mx-auto h-3.5 w-3.5 text-muted-foreground/60" />;

export function VersionCompare() {
  const { lang } = useI18n();
  const { fmt } = useMoney();
  const en = lang === "en";
  const tr = (pt: string, e: string) => (en ? e : pt);
  const mo = tr("/mês", "/mo");
  const rows: Row[] = [
    { label: "Bypass Play Protect", v457: yes, v46: yes },
    { label: tr("Módulos completos", "All modules"), v457: yes, v46: yes },
    { label: tr("Atualizações incluídas", "Updates included"), v457: <span className="text-muted-foreground">{tr("pagas à parte", "paid separately")}</span>, v46: <span className="font-semibold text-primary">{tr("grátis para sempre", "free forever")}</span>, highlight: true },
    { label: tr("Novos módulos (2026+)", "New modules (2026+)"), v457: no, v46: yes },
    { label: tr("Suporte prioritário 24/7", "24/7 priority support"), v457: no, v46: yes },
    { label: tr("Fila prioritária no Cloak", "Priority Cloak queue"), v457: no, v46: yes },
    { label: tr("Renovação mensal", "Monthly renewal"), v457: <span className="text-muted-foreground">{fmt(750)}{mo}</span>, v46: <span className="text-primary">{tr("única · vitalícia", "one-time · lifetime")}</span> },
    { label: tr("Servidor incluso", "Server fee"), v457: <span className="text-muted-foreground">{fmt(450)}{mo}</span>, v46: <span className="text-muted-foreground">{fmt(450)}{mo}</span> },
  ];
  return (
    <section className="mt-16">
      <div className="mb-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">// v4.5.7 vs v4.6</div>
        <h2 className="mt-2 font-display text-2xl md:text-3xl">{tr("Qual versão faz sentido para você", "Which version is right for you")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          {tr("A 4.5.7 é a estável mensal que a maioria opera hoje. A 4.6 é o salto arquitetural com módulos novos e updates vitalícios inclusos.", "4.5.7 is the stable monthly version most people run today. 4.6 is the big upgrade with new modules and lifetime updates included.")}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/40">
        <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center border-b border-border/50 bg-background/40">
          <div className="px-4 py-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{tr("Recurso", "Feature")}</div>
          <div className="border-l border-border/40 px-2 py-4 text-center md:px-4">
            <div className="flex items-center justify-center gap-2">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-foreground">v4.5.7</span>
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{tr("estável mensal", "stable monthly")}</div>
          </div>
          <div className="border-l border-border/40 bg-primary/5 px-2 py-4 text-center md:px-4">
            <div className="flex items-center justify-center gap-2">
              <Crown className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-primary">v4.6</span>
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-primary/80">{tr("vitalícia · recomendada", "lifetime · recommended")}</div>
          </div>
        </div>

        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`grid grid-cols-[1.4fr_1fr_1fr] items-center text-xs md:text-sm ${
              i % 2 ? "bg-background/20" : ""
            } ${r.highlight ? "bg-primary/5" : ""}`}
          >
            <div className="px-4 py-3 text-muted-foreground">{r.label}</div>
            <div className="border-l border-border/40 px-2 py-3 text-center font-mono md:px-4">{r.v457}</div>
            <div className="border-l border-border/40 bg-primary/[0.03] px-2 py-3 text-center font-mono md:px-4">{r.v46}</div>
          </div>
        ))}

        <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center border-t border-border/50 bg-background/40">
          <div className="px-4 py-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{tr("Melhor para", "Best for")}</div>
          <div className="border-l border-border/40 px-2 py-4 text-center text-xs text-muted-foreground md:px-4">
            {tr("Quem opera esporadicamente", "Occasional use")}
          </div>
          <div className="border-l border-border/40 bg-primary/5 px-2 py-4 text-center text-xs font-semibold text-primary md:px-4">
            {tr("Quem usa direto · maior ROI", "Daily use · best ROI")}
          </div>
        </div>
      </div>
    </section>
  );
}
