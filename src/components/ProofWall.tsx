import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ShieldCheck } from "lucide-react";
import p1 from "@/assets/proof/proof-1.jpg.asset.json";
import p2 from "@/assets/proof/proof-2.jpg.asset.json";
import p3 from "@/assets/proof/proof-3.jpg.asset.json";
import p4 from "@/assets/proof/proof-4.jpg.asset.json";
import pPhones from "@/assets/proof/proof-phones.jpg.asset.json";
import pPix300 from "@/assets/proof/proof-pix-300.jpg.asset.json";
import pDouglas from "@/assets/proof/proof-telegram-douglas.jpg.asset.json";

type Shot = { src: string; caption: string; tag: string; accent: "neon" | "cyan" | "violet" };

const shots: Shot[] = [
  {
    src: pPhones.url,
    caption: '"Deu bom" · "finalmente 🔥🔥" — 3 dispositivos espelhados no PC operando em tempo real.',
    tag: "Operação real",
    accent: "neon",
  },
  {
    src: p2.url,
    caption: 'PIX de R$ 1.800 recebido · cliente confirma "meu login ai · ta rodando ag ainda"',
    tag: "Pagamento + entrega",
    accent: "cyan",
  },
  {
    src: p4.url,
    caption: 'PIX de R$ 900 do "cliente btmob" — "Brigado pela confiança 🔥"',
    tag: "Cliente recorrente",
    accent: "violet",
  },
  {
    src: pPix300.url,
    caption: 'Renovação de R$ 300 · painel responde "Expire Date updated successfully!" em segundos.',
    tag: "Renovação automática",
    accent: "cyan",
  },
  {
    src: p3.url,
    caption: 'Entrega do BTMOB 4.0 FULL SRC (912 MB) · "Obrigado pela confiança 🔥🔥🔥"',
    tag: "Código-fonte entregue",
    accent: "neon",
  },
  {
    src: pDouglas.url,
    caption: '"Se eu for precisando de suporte só acionar né?" · "sim claro" — suporte pós-venda ativo.',
    tag: "Suporte contínuo",
    accent: "violet",
  },
  {
    src: p1.url,
    caption: '"criar seu login e ja era" · "ja ta tudo pronto" — ativação instantânea confirmada pelo cliente.',
    tag: "Ativação em minutos",
    accent: "neon",
  },
];

const accentBadge: Record<string, string> = {
  neon: "border-neon/40 bg-neon/10 text-neon",
  cyan: "border-cyan/40 bg-cyan/10 text-cyan",
  violet: "border-violet/40 bg-violet/10 text-violet",
};

export function ProofWall() {
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
            // provas reais
          </div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            A ferramenta funciona. <span className="italic text-cyan">Aqui está a prova.</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Prints reais de conversas, pagamentos aprovados e ativações confirmadas por clientes ao longo dos últimos meses. Sem edição, sem ator.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-neon" />
          Dados pessoais borrados · nomes autorizados
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
            <img
              src={s.src}
              alt={s.caption}
              loading="lazy"
              className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 top-0 flex justify-start p-2">
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
            </div>
            <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/70 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <ZoomIn className="h-3.5 w-3.5 text-neon" />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        clique em qualquer print para ampliar · use ← → para navegar
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
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 hover:border-neon/60 md:h-12 md:w-12"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 hover:border-neon/60 md:h-12 md:w-12"
            aria-label="Próxima"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={shots[open].src}
              alt={shots[open].caption}
              className="max-h-[75vh] w-auto rounded-lg border border-border object-contain shadow-2xl"
            />
            <div className="w-full rounded-md border border-border bg-card/60 p-3 text-center backdrop-blur">
              <div
                className={`inline-block rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${accentBadge[shots[open].accent]}`}
              >
                {shots[open].tag}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-foreground/90">
                {shots[open].caption}
              </p>
              <div className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {open + 1} / {shots.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
