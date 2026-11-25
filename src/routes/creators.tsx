import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Sparkles, Clapperboard, Gift, Megaphone, KeyRound, Send, Trophy, Crown,
  ShieldCheck, PlayCircle, ArrowRight, Youtube, Instagram,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getPublicCreatorVideos, type PublicCreatorVideo } from "@/lib/creator-public.functions";

export const Route = createFileRoute("/creators")({
  head: () => ({
    meta: [
      { title: "Seja Creator Shadow — licença grátis por fazer vídeos" },
      { name: "description", content: "Grave vídeos sobre a Shadow e ganhe uma licença BTmob grátis, recompensas e níveis. Sem meta de vendas. Candidate-se em 1 minuto." },
      { property: "og:title", content: "Programa Creator Shadow" },
      { property: "og:description", content: "Fale da Shadow, ganhe acesso. Licença grátis, recompensas e níveis para creators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatorsLanding,
});

const STEPS = [
  { icon: Sparkles, t: "Candidate-se", d: "Mande seus canais (YouTube, TikTok, Instagram e outros). A equipe revisa e aprova." },
  { icon: KeyRound, t: "Resgate a licença", d: "Aprovado, você recebe uma licença BTmob de verdade para mostrar o painel funcionando." },
  { icon: Send, t: "Grave e poste", d: "Siga o roteiro, publique nas suas redes e envie o link. Suba de nível a cada vídeo aprovado." },
];

const TIERS = [
  { name: "Iniciante", req: "Primeiro vídeo", perk: "Entre no programa e receba sua licença para começar.", top: false },
  { name: "Bronze", req: "1 vídeo aprovado", perk: "Creator ativo: prioridade no suporte e destaque nos sorteios.", top: false },
  { name: "Prata", req: "5 vídeos", perk: "Recompensas extras: dias de licença e bônus avaliados pela equipe.", top: false },
  { name: "Ouro", req: "15 vídeos", perk: "Creator parceiro: a equipe entra em contato para recompensas maiores.", top: true },
];

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", kwai: "Kwai",
  facebook: "Facebook", telegram: "Telegram", x: "X",
};

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "youtube") return <Youtube className="h-3.5 w-3.5" />;
  if (platform === "instagram") return <Instagram className="h-3.5 w-3.5" />;
  return <PlayCircle className="h-3.5 w-3.5" />;
}

function CreatorsLanding() {
  const videosFn = useServerFn(getPublicCreatorVideos);
  const [videos, setVideos] = useState<PublicCreatorVideo[]>([]);

  useEffect(() => {
    let active = true;
    videosFn().then((r) => { if (active) setVideos(r ?? []); }).catch(() => {});
    return () => { active = false; };
  }, [videosFn]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4">
        {/* HERO */}
        <section className="relative overflow-hidden pt-16 pb-14 text-center md:pt-24 md:pb-20">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0,oklch(0.65_0.16_260/0.18),transparent_70%)]" />
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="relative"
          >
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_oklch(0.65_0.16_260/0.6)]" />
              Programa Creator — vagas abertas
            </span>
            <h1 className="font-display text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              Fale da Shadow.<br /><span className="text-primary">Ganhe acesso.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Grave vídeos usando o painel de verdade e receba uma licença BTmob grátis, recompensas e níveis. Sem meta de vendas — é só criar.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/dashboard">
                <Button size="lg" className="h-12 rounded-xl px-7 text-sm font-semibold shadow-lg shadow-primary/40 hover:shadow-primary/60">
                  Quero ser Creator <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <a href="#vitrine">
                <Button size="lg" variant="outline" className="h-12 rounded-xl border-border/60 px-6 text-sm font-semibold">
                  Ver vídeos dos creators
                </Button>
              </a>
            </div>
          </motion.div>

          <div className="relative mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { n: "Licença grátis", l: "para gravar com o painel real", icon: Gift },
              { n: "4 níveis", l: "quanto mais vídeo, mais recompensa", icon: Trophy },
              { n: "Suporte VIP", l: "prioridade para creator ativo", icon: ShieldCheck },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-border/60 bg-card/40 p-4 text-left">
                <s.icon className="mb-2 h-5 w-5 text-primary" />
                <div className="font-display text-lg font-bold text-primary">{s.n}</div>
                <div className="text-xs text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section className="py-16">
          <p className="text-sm font-semibold text-primary">Como funciona</p>
          <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">Três passos, sem burocracia</h2>
          <p className="mt-2 max-w-md text-muted-foreground">Você se candidata, a equipe libera sua licença, e aí é só gravar e postar.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.t} className="rounded-2xl border border-border/60 bg-card/40 p-6">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 font-display text-sm font-black text-primary">{i + 1}</div>
                <s.icon className="mb-3 h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* RECOMPENSAS */}
        <section className="py-16">
          <p className="text-sm font-semibold text-primary">Recompensas</p>
          <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">Quanto mais você cria, mais ganha</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t) => (
              <div key={t.name} className={`rounded-2xl border p-5 ${t.top ? "border-primary/45 bg-primary/[0.06]" : "border-border/60 bg-card/40"}`}>
                <div className="flex items-center gap-1.5">
                  {t.top && <Crown className="h-4 w-4 text-primary" />}
                  <div className={`font-bold ${t.top ? "text-primary" : ""}`}>{t.name}</div>
                </div>
                <div className="mt-0.5 text-xs font-semibold text-primary/80">{t.req}</div>
                <p className="mt-3 text-sm text-muted-foreground">{t.perk}</p>
              </div>
            ))}
          </div>
        </section>

        {/* VITRINE */}
        <section id="vitrine" className="scroll-mt-24 py-16">
          <p className="text-sm font-semibold text-primary">Vitrine</p>
          <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">Feito por creators de verdade</h2>
          <p className="mt-2 max-w-md text-muted-foreground">Vídeos reais da comunidade — a prova de que o programa funciona.</p>
          {videos.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              Os primeiros vídeos aparecem aqui assim que forem aprovados. Pode ser o seu.
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v, i) => (
                <a
                  key={i} href={v.href} target="_blank" rel="noopener noreferrer nofollow"
                  className="group overflow-hidden rounded-2xl border border-border/60 bg-card/40 transition-colors hover:border-primary/40"
                >
                  <div className="relative flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-primary/[0.08] to-background">
                    {v.platform && (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        <PlatformIcon platform={v.platform} /> {PLATFORM_LABEL[v.platform] ?? v.platform}
                      </span>
                    )}
                    <PlayCircle className="h-12 w-12 text-primary/80 transition-transform group-hover:scale-110" />
                  </div>
                  <div className="p-4">
                    <div className="line-clamp-2 text-sm font-semibold">{v.title || "Vídeo sobre a Shadow"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{v.creator}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* CTA FINAL */}
        <section className="pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card/40 p-12 text-center">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(90%_120%_at_50%_0,oklch(0.65_0.16_260/0.14),transparent_70%)]" />
            <div className="relative">
              <Clapperboard className="mx-auto mb-4 h-10 w-10 text-primary" />
              <h2 className="font-display text-3xl font-black tracking-tight md:text-4xl">Pronto para criar?</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">Candidatura leva 1 minuto. A equipe responde rápido.</p>
              <Link to="/dashboard">
                <Button size="lg" className="mt-6 h-12 rounded-xl px-8 text-sm font-semibold shadow-lg shadow-primary/40 hover:shadow-primary/60">
                  Quero ser Creator <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Megaphone className="h-3.5 w-3.5 text-primary/60" /> Já tem conta? O pedido é feito direto no seu painel.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
