import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ShieldCheck } from "lucide-react";
import { ProgressiveImage } from "./ProgressiveImage";
import { useI18n } from "@/lib/i18n";

const p1 = { url: "/img/proof-1.webp", fallback: "/img/proof-1.jpg" };
const p2 = { url: "/img/proof-2.webp", fallback: "/img/proof-2.jpg" };
const p3 = { url: "/img/proof-3.webp", fallback: "/img/proof-3.jpg" };
const p4 = { url: "/img/proof-4.webp", fallback: "/img/proof-4.jpg" };
const pPhones = { url: "/img/proof-phones.webp", fallback: "/img/proof-phones.jpg" };
const pPix300 = { url: "/img/proof-pix-300.webp", fallback: "/img/proof-pix-300.jpg" };
const pDouglas = { url: "/img/proof-telegram-douglas.webp", fallback: "/img/proof-telegram-douglas.jpg" };

type Shot = { src: string; fallback: string; caption: string; tag: string; accent: "neon" | "cyan" | "violet"; ref?: string; source?: string; date?: string };

const refCode = (i: number) => `REF-${String(i + 1).padStart(2, "0")}`;

const shots: Shot[] = [
  {
    src: pPhones.url,
    fallback: pPhones.fallback,
    caption: t("pw.caption.phones"),
    tag: t("pw.tag.operation"),
    source: t("pw.source.wa"),
    date: "jan/2026",
    accent: "neon",
  },
  {
    src: p2.url,
    fallback: p2.fallback,
    caption: t("pw.caption.pix1800"),
    tag: t("pw.tag.payment"),
    source: t("pw.source.mp"),
    date: "jan/2026",
    accent: "cyan",
  },
  {
    src: p4.url,
    fallback: p4.fallback,
    caption: t("pw.caption.pix900"),
    tag: t("pw.tag.recurring"),
    source: t("pw.source.mp"),
    date: "fev/2026",
    accent: "violet",
  },
  {
    src: pPix300.url,
    fallback: pPix300.fallback,
    caption: t("pw.caption.renew300"),
    tag: t("pw.tag.autorenew"),
    source: t("pw.source.panel"),
    date: "jan/2026",
    accent: "cyan",
  },
  {
    src: p3.url,
    fallback: p3.fallback,
    caption: t("pw.caption.src"),
    tag: t("pw.tag.sourcecode"),
    source: t("pw.source.wa"),
    date: "2026",
    accent: "neon",
  },
  {
    src: pDouglas.url,
    fallback: pDouglas.fallback,
    caption: t("pw.caption.support"),
    tag: t("pw.tag.support"),
    source: t("pw.source.tg"),
    date: "2026",
    accent: "violet",
  },
  {
    src: p1.url,
    fallback: p1.fallback,
    caption: t("pw.caption.activation"),
    tag: t("pw.tag.activation"),
    source: t("pw.source.wa"),
    date: "2026",
    accent: "neon",
  },
];

const accentBadge: Record<string, string> = {
  neon: "border-neon/40 bg-neon/10 text-neon",
  cyan: "border-cyan/40 bg-cyan/10 text-cyan",
  violet: "border-violet/40 bg-violet/10 text-violet",
};

export function ProofWall() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const prev = useCallback(
    () => setOpen((i) => (i === null ? null : (i - 1 + shots.length) % shots.length)),
    [],
  );
  const next = useCallback(
    () => setOpen((i) => (i === null ? null : (i + 1) % shots.length)),
    [],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, prev, next]);

  return (
    <section className="border-t border-border py-20">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan">
            {t("pw.kicker")}
          </div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            {t("pw.title").split('falam')[0]} <span className="italic text-cyan">falam por si.</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            {t("pw.desc")}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-neon" />
          {t("pw.badge")}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {shots.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative aspect-[9/16] overflow-hidden rounded-lg border border-border bg-card/40 transition-all hover:border-neon/40 hover:shadow-lg hover:shadow-neon/10"
          >
            <ProgressiveImage
              src={s.src}
              alt={s.caption}
              className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-start gap-1 p-2">
              <span className="rounded border border-border/60 bg-background/75 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-muted-foreground backdrop-blur-sm">
                {refCode(i)}
              </span>
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider backdrop-blur-sm ${accentBadge[s.accent]}`}
              >
                {s.tag}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-3 pt-10">
              <p className="line-clamp-2 text-[11px] leading-snug text-foreground/90">
                {s.caption}
              </p>
              {(s.source || s.date) && (
                <p className="mt-1 font-mono text-[8px] uppercase tracking-wider text-muted-foreground/80">
                  fonte: {s.source}{s.date ? ` · ${s.date}` : ""}
                </p>
              )}
            </div>
            <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/70 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <ZoomIn className="h-3.5 w-3.5 text-neon" />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {t("pw.label.ref")} (REF-01 … REF-{String(shots.length).padStart(2, "0")}) · {t("pw.label.nav")}
      </div>

      {open !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-md"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/80 text-foreground hover:border-neon/60"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 hover:border-neon/60 md:h-12 md:w-12"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 hover:border-neon/60 md:h-12 md:w-12"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <ProgressiveImage
              src={shots[open].src}
              alt={shots[open].caption}
              className="max-h-[75vh] w-auto rounded-lg border border-border object-contain shadow-2xl"
            />
            <div className="w-full rounded-md border border-border bg-card/60 p-3 text-center backdrop-blur">
              <div className="flex items-center justify-center gap-1.5">
                <span className="rounded border border-border/60 bg-background/70 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-muted-foreground">
                  {refCode(open)}
                </span>
                <span
                  className={`inline-block rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${accentBadge[shots[open].accent]}`}
                >
                  {shots[open].tag}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-foreground/90">
                {shots[open].caption}
              </p>
              <div className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                fonte: {shots[open].source ?? "captura original"}{shots[open].date ? ` · ${shots[open].date}` : ""}
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                {open + 1} / {shots.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
