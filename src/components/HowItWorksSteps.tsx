import { CreditCard, KeyRound, MousePointerClick, Download, LifeBuoy, ShieldCheck } from "lucide-react";

type Step = { icon: any; title: string; text: string };

const CHECKOUT_STEPS: Step[] = [
  {
    icon: MousePointerClick,
    title: "1. Escolha seu plano",
    text: "Clique em “Comprar via PIX” no plano que quiser. Se estiver em dúvida, o Mensal atende a maioria das pessoas.",
  },
  {
    icon: CreditCard,
    title: "2. Pague o PIX",
    text: "Você é levado para o Mercado Pago oficial. Copie o código PIX, pague no seu banco e volte para o site.",
  },
  {
    icon: KeyRound,
    title: "3. Receba o acesso",
    text: "Em menos de 1 minuto o login, a senha e o IP aparecem sozinhos no seu painel. Não precisa falar com ninguém.",
  },
];

const DASHBOARD_STEPS: Step[] = [
  {
    icon: KeyRound,
    title: "1. Copie suas credenciais",
    text: "No card da sua licença ficam usuário, senha e IP do servidor. O botão de copiar já leva tudo junto.",
  },
  {
    icon: Download,
    title: "2. Baixe o app da sua versão",
    text: "Na aba “Downloads” aparece só o arquivo liberado para o seu plano. Instale e faça login com os dados copiados.",
  },
  {
    icon: LifeBuoy,
    title: "3. Precisou de ajuda?",
    text: "Use o Suporte aqui do painel. Respondemos no chat e o histórico fica salvo na sua conta.",
  },
];

export function HowItWorksSteps({
  variant = "checkout",
  title,
  className = "",
}: {
  variant?: "checkout" | "dashboard";
  title?: string;
  className?: string;
}) {
  const steps = variant === "dashboard" ? DASHBOARD_STEPS : CHECKOUT_STEPS;
  const heading = title ?? (variant === "dashboard" ? "Como usar seu acesso" : "Como funciona a compra");

  return (
    <section className={`rounded-2xl border border-border/50 bg-card/40 p-5 md:p-6 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg md:text-xl">{heading}</h2>
        <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:block">
          simples e sem burocracia
        </span>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} className="rounded-xl border border-border/40 bg-background/40 p-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold">{s.title}</div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
