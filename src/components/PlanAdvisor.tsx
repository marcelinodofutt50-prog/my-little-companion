import { Clock, Calendar, Crown, HelpCircle } from "lucide-react";

const OPTIONS = [
  {
    icon: Clock,
    who: "Quero só testar antes",
    pick: "Plano Semanal",
    why: "7 dias de acesso na versão básica. Serve pra ver a ferramenta funcionando sem gastar muito.",
  },
  {
    icon: Calendar,
    who: "Uso todo mês",
    pick: "Plano Mensal",
    why: "É o mais escolhido. Versão completa 4.5.7 por 30 dias, com suporte no chat do painel.",
  },
  {
    icon: Crown,
    who: "Quero pagar uma vez só",
    pick: "Plano Vitalício",
    why: "Paga uma vez e usa pra sempre a linha 4.6+, com atualizações grátis e suporte prioritário.",
  },
];

export function PlanAdvisor({ className = "" }: { className?: string }) {
  return (
    <section className={`rounded-2xl border border-border/50 bg-card/40 p-5 md:p-6 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg md:text-xl">Qual plano é o meu?</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {OPTIONS.map((o) => (
          <div key={o.pick} className="rounded-xl border border-border/40 bg-background/40 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <o.icon className="h-4 w-4 text-primary" />
              {o.who}
            </div>
            <div className="mt-2 font-display text-lg text-primary">{o.pick}</div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{o.why}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        ⚠️ <b className="text-primary uppercase">Diferença Importante:</b> Os planos acima criam um <b className="text-foreground">NOVO LOGIN</b> (usuário e senha novos). Se você já tem um login ativo e só precisa pagar a manutenção mensal, use a <b className="text-foreground italic">Renovação Servidor</b> logo abaixo.
      </p>
    </section>
  );
}
