import { TrendingUp, Clock, ShieldAlert, Zap, DollarSign, Target } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BeforeAfter() {
  const { t } = useI18n();

  const rows = [
    {
      icon: Clock,
      metric: t("ba.metric.setup"),
      before: "3–7 dias tentando compilar sozinho",
      after: "< 60 segundos após o PIX",
      lift: "-99%",
    },
    {
      icon: ShieldAlert,
      metric: t("ba.metric.risk"),
      before: "APK bloqueado no primeiro install",
      after: "Bypass automático em cada build",
      lift: "0 falhas",
    },
    {
      icon: Target,
      metric: t("ba.metric.success"),
      before: "~35% (build instável, crash)",
      after: "98%+ verificado por clientes",
      lift: "+180%",
    },
    {
      icon: Zap,
      metric: t("ba.metric.support"),
      before: "Fóruns, Discord, sem resposta",
      after: "Chat interno · resposta em min.",
      lift: "24/7",
    },
    {
      icon: DollarSign,
      metric: t("ba.metric.cost"),
      before: "R$ 1.200+ (VPS + dev + tempo)",
      after: "A partir de R$ 300/mês",
      lift: "-75%",
    },
  ];

  return (
    <section className="border-t border-border py-20">
      <div className="mb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan">
          {t("ba.kicker")}
        </div>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">
          {t("ba.title").split('Shadow')[0]} <span className="italic text-cyan">Shadow BTMOB.</span>
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {t("ba.desc")}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border terminal-card">
        {/* Header */}
        <div className="grid grid-cols-12 border-b border-border bg-card/40 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground md:px-6">
          <div className="col-span-4 md:col-span-3">{t("ba.col.metric")}</div>
          <div className="col-span-4 text-destructive/80">{t("ba.col.before")}</div>
          <div className="col-span-4 text-neon">{t("ba.col.after")}</div>
          <div className="hidden md:col-span-1 md:block text-right">{t("ba.col.gain")}</div>
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
