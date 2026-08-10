import { ShieldCheck, Zap } from "lucide-react";
import { ProgressiveImage } from "./ProgressiveImage";
import { useI18n } from "@/lib/i18n";

const shots = [
  {
    src: "/img/proof-itau-10k.webp",
    fallback: "/img/proof-itau-10k.png",
    tag: "Itaú",
    caption: "Transação confirmada no app do banco.",
  },
  {
    src: "/img/proof-caixa-990.webp",
    fallback: "/img/proof-caixa-990.png",
    tag: "Caixa",
    caption: "Pix enviado e comprovado em tempo real.",
  },
];

export function ImpossibleProof({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();

  return (
    <section className="rounded-xl border border-neon/30 bg-gradient-to-b from-neon/5 to-transparent p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-neon" />
        <div>
          <h3 className="font-mono text-sm uppercase tracking-wider sm:text-base">
            {t("pw.kicker").replace('// ', '')}
          </h3>
          <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
            {t("pw.desc").split('—')[1]?.trim() || t("pw.desc")}
          </p>
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "grid-cols-2" : "sm:grid-cols-2 max-w-2xl mx-auto"}`}>
        {shots.map((s) => (
          <figure key={s.src} className="overflow-hidden rounded-lg border border-border/60 bg-card/50">
            <div className="flex aspect-[4/5] w-full items-center justify-center bg-background/60">
              <ProgressiveImage
                src={s.src}
                alt={s.tag}
                className="h-full w-full object-contain p-1"
              />
            </div>

            <figcaption className="space-y-1 p-3">
              <span className="inline-flex items-center gap-1 rounded border border-neon/40 bg-neon/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neon">
                <Zap className="h-3 w-3" />
                {s.tag}
              </span>
              {!compact && (
                <p className="text-[11px] leading-snug text-muted-foreground">{s.caption}</p>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
