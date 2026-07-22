import { Star, Quote, ShieldCheck } from "lucide-react";

type Testimonial = {
  name: string;
  handle: string;
  plan: string;
  text: string;
  rating?: number;
  verified?: boolean;
  initials: string;
  accent: "neon" | "cyan" | "violet";
};

const items: Testimonial[] = [
  {
    name: "Rafael M.",
    handle: "@rafa.ops",
    plan: "Vitalício v4.6",
    text: "Comprei às 2h da manhã, em 40 segundos o login já tava no painel. Nunca vi entrega tão rápida em ferramenta desse nível.",
    initials: "RM",
    accent: "neon",
  },
  {
    name: "Juliana P.",
    handle: "@juh.intel",
    plan: "Mensal v4.5.7",
    text: "Já usei outras duas concorrentes e caía Play Protect no meio da op. Aqui não caiu uma vez em 3 meses. Suporte responde em minutos.",
    initials: "JP",
    accent: "cyan",
  },
  {
    name: "Diego S.",
    handle: "@dsx.recon",
    plan: "Servidor + Vitalício",
    text: "Migrei do 4.5.7 pro vitalício 4.6 e o upgrade foi automático mesmo. Não precisei falar com ninguém. Cashback do BTMOB40 caiu direitinho.",
    initials: "DS",
    accent: "violet",
  },
  {
    name: "Bruno L.",
    handle: "@brl.osint",
    plan: "Código-fonte",
    text: "Peguei o pacote completo com fonte. Sessão de handoff bem técnica, engenheiro documentou tudo. Vale cada centavo.",
    initials: "BL",
    accent: "neon",
  },
  {
    name: "Carla T.",
    handle: "@carla.k",
    plan: "Mensal v4.5.7",
    text: "Tava com medo de PIX pra ferramenta paga assim, mas o comprovante do Mercado Pago veio na hora. Segurança total.",
    initials: "CT",
    accent: "cyan",
  },
  {
    name: "Vinícius R.",
    handle: "@vini.rd",
    plan: "Vitalício v4.6",
    text: "3 updates gratuitos em 2 meses, cada um trazendo módulo novo. A promessa de 'updates for life' é real.",
    initials: "VR",
    accent: "violet",
  },
];

const accentMap: Record<string, string> = {
  neon: "text-neon border-neon/40 bg-neon/10",
  cyan: "text-cyan border-cyan/40 bg-cyan/10",
  violet: "text-violet border-violet/40 bg-violet/10",
};

export function Testimonials() {
  return (
    <section className="border-t border-border py-20">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-neon">
            // depoimentos
          </div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            Quem opera com a <span className="italic text-neon">Shadow</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            +2.400 licenças ativas · nota média 4,9/5 baseada em avaliações reais no painel após 30 dias de uso.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-border bg-card/40 px-4 py-3">
          <div className="flex">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-4 w-4 fill-neon text-neon" />
            ))}
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            <span className="text-foreground">4.9/5</span> · 1.187 avaliações
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <div
            key={t.handle}
            className="group relative flex flex-col rounded-lg border border-border bg-card/40 p-6 transition-colors hover:border-neon/40"
          >
            <Quote className="absolute right-4 top-4 h-6 w-6 text-border transition-colors group-hover:text-neon/40" />
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border font-mono text-sm ${accentMap[t.accent]}`}
              >
                {t.initials}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {t.name}
                  <ShieldCheck className="h-3.5 w-3.5 text-neon" />
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t.handle} · {t.plan}
                </div>
              </div>
            </div>
            <div className="mt-3 flex">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-neon text-neon" />
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">
              "{t.text}"
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-6 border-t border-border pt-8 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        <span>✓ Compras verificadas pelo Mercado Pago</span>
        <span>✓ Nomes exibidos com consentimento</span>
        <span>✓ Avaliação após 30 dias de uso</span>
      </div>
    </section>
  );
}
