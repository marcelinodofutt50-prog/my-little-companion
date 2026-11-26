import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  CheckCircle2, Receipt, UploadCloud, ShieldCheck, Clock, ArrowRight,
  Headset, Sparkles, LayoutDashboard,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

// Verde de "pago" (sinal universal de pagamento confirmado), usado com parcimônia
// sobre o azul da marca.
const OK = "oklch(0.72 0.17 155)";
const ok = (a: number) => `oklch(0.72 0.17 155 / ${a})`;

export const Route = createFileRoute("/obrigado")({
  head: () => ({
    meta: [
      { title: "Confirme seu pagamento — Shadow" },
      { name: "description", content: "Se você concluiu o pagamento, envie a confirmação no suporte para a equipe liberar seu acesso." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Confirme seu pagamento — Shadow" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ObrigadoPage,
});

const STEPS = [
  {
    icon: Receipt,
    t: "Pagamento no checkout",
    d: "Você concluiu o pagamento pelo link de checkout.",
  },
  {
    icon: UploadCloud,
    t: "Envie o comprovante",
    d: "Abra um chamado no suporte e anexe o comprovante (print ou PDF). É o que confirma a sua compra.",
  },
  {
    icon: Sparkles,
    t: "Acesso liberado",
    d: "Validado o comprovante, a equipe ativa a sua licença e entrega o acesso pelo próprio suporte.",
  },
];

function ObrigadoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="relative overflow-hidden">
        {/* brilho de fundo */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-96"
          style={{ background: `radial-gradient(60% 100% at 50% 0, ${ok(0.12)}, transparent 70%)` }}
        />

        <div className="relative mx-auto max-w-2xl px-4 py-14 md:py-20">
          {/* HERO */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 14, stiffness: 180, delay: 0.1 }}
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border"
              style={{ borderColor: ok(0.4), background: ok(0.1), boxShadow: `0 0 40px -8px ${ok(0.5)}` }}
            >
              <Receipt className="h-10 w-10" style={{ color: OK }} />
            </motion.div>

            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: ok(0.35), color: OK, background: ok(0.08) }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Último passo
            </span>

            <h1 className="mt-5 font-display text-4xl font-black tracking-tight md:text-5xl">
              Pagou? Falta só <span style={{ color: OK }}>confirmar</span>.
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              Se você concluiu o pagamento, <span className="text-foreground">envie a confirmação para a nossa equipe</span>. Este checkout não libera o acesso de forma automática — assim que recebermos e validarmos o seu <span className="text-foreground">comprovante</span>, a sua licença é ativada. Leva 1 minuto.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/suporte">
                <Button
                  size="lg"
                  className="h-12 rounded-xl px-7 text-sm font-semibold text-white"
                  style={{ background: OK, boxShadow: `0 14px 34px -12px ${ok(0.7)}` }}
                >
                  <Headset className="mr-2 h-4 w-4" /> Enviar comprovante no suporte
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="outline" className="h-12 rounded-xl border-border/60 px-6 text-sm font-semibold">
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Ir para o painel
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* PASSOS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-14"
          >
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Como funciona
            </p>
            <div className="space-y-3">
              {STEPS.map((s, i) => (
                <div key={s.t} className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card/30 p-5">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-display text-sm font-black"
                    style={{ borderColor: "oklch(0.65 0.16 260 / 0.3)", background: "oklch(0.65 0.16 260 / 0.08)", color: "oklch(0.65 0.16 260)" }}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{s.t}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* REASSURANCE */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
              <Clock className="h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Resposta rápida.</span> A equipe confirma seu comprovante e libera o acesso o quanto antes.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Seu pagamento está seguro.</span> Guarde o comprovante até o acesso ser liberado.
              </p>
            </div>
          </div>

          {/* CTA final discreto */}
          <div className="mt-10 text-center">
            <Link to="/suporte" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              Abrir o suporte agora <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
