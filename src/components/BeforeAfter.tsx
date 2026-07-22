import { TrendingUp, Clock, ShieldAlert, Zap, DollarSign, Target } from "lucide-react";

const rows = [
  {
    icon: Clock,
    metric: "Tempo de setup",
    before: "3–7 dias tentando compilar sozinho",
    after: "< 60 segundos após o PIX",
    lift: "-99%",
  },
  {
    icon: ShieldAlert,
    metric: "Risco de Play Protect",
    before: "APK bloqueado no primeiro install",
    after: "Bypass automático em cada build",
    lift: "0 falhas",
  },
  {
    icon: Target,
    metric: "Taxa de sucesso em campo",
    before: "~35% (build instável, crash)",
    after: "98%+ verificado por clientes",
    lift: "+180%",
  },
  {
    icon: Zap,
    metric: "Suporte técnico",
    before: "Fóruns, Discord, sem resposta",
    after: "Chat interno · resposta em min.",
    lift: "24/7",
  },
  {
    icon: DollarSign,
    metric: "Custo mensal real",
    before: "R$ 1.200+ (VPS + dev + tempo)",
    after: "A partir de R$ 300/mês",
    lift: "-75%",
  },
];

export function BeforeAfter() {
  return (
    <section className="border-t border-border py-20">
      <div className="mb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan">
          // antes vs depois
        </div>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">
          O que muda quando você usa <span className="italic text-cyan">Shadow BTMOB.</span>
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Métricas reais reportadas pelos operadores que já migraram de builds próprios ou de concorrentes instáveis. Sem promessa vaga — número frio.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border terminal-card">
        {/* Header */}
        <div className="grid grid-cols-12 border-b border-border bg-card/40 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground md:px-6">
          <div className="col-span-4 md:col-span-3">Métrica</div>
          <div className="col-span-4 text-destructive/80">Sem Shadow</div>
          <div className="col-span-4 text-neon">Com Shadow</div>
          <div className="hidden md:col-span-1 md:block text-right">Ganho</div>
        </div>

        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <div
              key={r.metric}
              className={`grid grid-cols-12 items-center gap-2 px-4 py-4 md:px-6 md:py-5 ${
                i !== rows.length - 1 ? "border-b border-border/60" : ""
              } hover:bg-card/30 transition-colors`}
            >
              <div className="col-span-12 mb-2 flex items-center gap-2.5 md:col-span-3 md:mb-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                  <Icon className="h-4 w-4 text-cyan" />
                </div>
                <div className="font-mono text-xs uppercase tracking-wide text-foreground">
                  {r.metric}
                </div>
              </div>

              <div className="col-span-6 md:col-span-4">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive/70" />
                  <span className="text-xs leading-relaxed text-muted-foreground line-through decoration-destructive/40">
                    {r.before}
                  </span>
                </div>
              </div>

              <div className="col-span-6 md:col-span-4">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neon" />
                  <span className="text-xs leading-relaxed text-foreground">{r.after}</span>
                </div>
              </div>

              <div className="col-span-12 mt-2 flex md:col-span-1 md:mt-0 md:justify-end">
                <span className="inline-flex items-center gap-1 rounded border border-neon/40 bg-neon/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-neon">
                  <TrendingUp className="h-3 w-3" />
                  {r.lift}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
