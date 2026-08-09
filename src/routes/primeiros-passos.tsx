import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Download, Settings, Play, Shield, LifeBuoy, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/primeiros-passos")({
  head: () => ({
    meta: [
      { title: "Primeiros passos — Shadow" },
      { name: "description", content: "Guia rápido para começar a usar o Shadow após a ativação da sua licença." },
      { property: "og:title", content: "Primeiros passos — Shadow" },
      { property: "og:description", content: "Guia rápido para começar a usar o Shadow após a ativação da sua licença." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});

const steps = [
  {
    icon: Download,
    title: "1. Download e Antivírus",
    body: "Baixe o Shadow Builder no painel. Importante: desative o Windows Defender/Antivírus ou adicione uma pasta de exclusão para evitar que o Windows apague o executável por engano.",
  },
  {
    icon: Settings,
    title: "2. Adicionar Servidor",
    body: "Entre no painel e vá na opção 'Add Server'. Insira seus dados de acesso e utilize qualquer Connection Key (exemplos populares: TxTxT, BTMOB ou 123456).",
  },
  {
    icon: Shield,
    title: "3. Configure o build corretamente",
    body: "Para evitar bloqueio do Play Protect, mantenha DESATIVADO os itens marcados em azul (DEX-Protetor e Aumentar tamanho). Deixe ATIVO Proteger aplicativo e Criptografar APK.",
  },
  {
    icon: Play,
    title: "4. Gere e teste seu app",
    body: "Aperte em Gerar. Ao terminar, instale o APK no dispositivo alvo e verifique se abre normalmente. Se algo estiver diferente, revise as opções do build.",
  },
  {
    icon: LifeBuoy,
    title: "5. Precisando de ajuda?",
    body: "Nossa equipe responde no chat de suporte 24/7. Prints do erro aceleram muito a resolução — mande direto na conversa.",
  },
];

function OnboardingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-14">
        <div className="mb-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">// welcome to shadow</div>
          <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">Primeiros passos</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Um guia direto pra você começar a operar o Shadow em menos de 5 minutos.
          </p>
        </div>

        <ol className="space-y-4">
          {steps.map((s) => (
            <li key={s.title} className="terminal-card scanlines relative flex items-start gap-4 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/5">
                <s.icon className="h-5 w-5 text-neon" />
              </div>
              <div className="min-w-0">
                <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-primary">{s.title}</h2>
                <p className="mt-1 text-sm text-foreground leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/dashboard">
            <Button className="font-mono uppercase">
              Ir para meu painel <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/tutorial">
            <Button variant="outline" className="font-mono uppercase">
              Ver tutorial completo
            </Button>
          </Link>
          <Link to="/suporte">
            <Button variant="ghost" className="font-mono uppercase">
              Falar com suporte
            </Button>
          </Link>
        </div>

        <div className="mt-8 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
          <span>
            Salve esta página nos favoritos. Ela é útil sempre que você for configurar um novo build ou orientar alguém da sua equipe.
          </span>
        </div>
      </main>
    </div>
  );
}
