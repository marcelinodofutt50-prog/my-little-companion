import { ArrowUpRight, Check, Crown, Loader2, Server, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBrl } from "@/lib/plans";

type PartnerPlan = {
  slug: string;
  name: string;
  description: string | null;
  price_brl: number;
  days: number | null;
};

const META: Record<
  string,
  { icon: any; tag: string; headline: string; bullets: string[]; cycle: string; featured?: boolean }
> = {
  "partner-reseller-60d": {
    icon: Crown,
    tag: "revenda",
    headline: "Quer vender seus próprios logins?",
    cycle: "a cada 2 meses",
    featured: true,
    bullets: [
      "Servidor exclusivo alugado no seu nome",
      "Painel próprio pra criar, renovar e cancelar logins",
      "Você fica com 100% do lucro das suas vendas",
      "Acesso liberado na hora em que o pagamento cai",
    ],
  },
  "server-deploy-basic": {
    icon: Wrench,
    tag: "serviço",
    headline: "Tem servidor mas não sabe deixar online?",
    cycle: "pagamento único",
    bullets: [
      "Instalação completa feita pela nossa equipe",
      "Entregamos o servidor rodando e testado",
      "Acompanhamento pelo chat até ficar no ar",
    ],
  },
  "server-deploy-managed": {
    icon: ShieldCheck,
    tag: "serviço + proteção",
    headline: "Instalação com proteção e supervisão",
    cycle: "pagamento único",
    bullets: [
      "Tudo do serviço básico, mais camada de proteção",
      "Nossa equipe supervisionando o servidor",
      "Combina com a gestão mensal de R$ 100",
    ],
  },
  "server-managed-monthly": {
    icon: Server,
    tag: "mensalidade",
    headline: "Nossa equipe cuidando de tudo",
    cycle: "por mês",
    bullets: [
      "Monitoramento e manutenção contínuos",
      "Atualizações aplicadas por nós",
      "Suporte técnico direto com a equipe",
    ],
  },
};

export function PartnerSection({
  plans,
  onBuy,
  loadingPlan,
}: {
  plans: PartnerPlan[];
  onBuy: (slug: string) => void;
  loadingPlan: string | null;
}) {
  return (
    <section className="mb-16" id="parceria">
      <div className="mb-6 flex flex-col gap-1 border-b border-border/40 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// novos produtos</div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl">Servidor & Revenda</h2>
        </div>
        <span className="text-sm text-muted-foreground">Área do parceiro liberada assim que o pagamento cai</span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {plans.map((p) => {
          const meta = META[p.slug] ?? {
            icon: Server,
            tag: "serviço",
            headline: p.name,
            cycle: p.days ? `a cada ${p.days} dias` : "pagamento único",
            bullets: [],
          };
          const Icon = meta.icon;
          return (
            <div
              key={p.slug}
              data-testid={`partner-${p.slug}`}
              className={`flex flex-col rounded-2xl border p-5 md:p-6 ${
                meta.featured ? "border-primary/50 bg-primary/5" : "border-border/50 bg-card/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary/80">{meta.tag}</span>
              </div>
              <h3 className="mt-2 font-display text-xl">{meta.headline}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.description}</p>

              <div className="mt-4 flex items-end gap-2">
                <span className="font-display text-3xl text-primary">{formatBrl(Number(p.price_brl))}</span>
                <span className="pb-1 text-xs text-muted-foreground">{meta.cycle}</span>
              </div>

              {meta.bullets.length > 0 ? (
                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {meta.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <Button
                className="mt-6 w-full"
                variant={meta.featured ? "default" : "outline"}
                disabled={loadingPlan !== null}
                onClick={() => onBuy(p.slug)}
              >
                {loadingPlan === p.slug ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                )}
                Contratar agora
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Depois do pagamento você recebe acesso imediato à <b className="text-foreground">Área do Parceiro</b>, onde
        acompanha o servidor, envia os dados de acesso e fala com a equipe.
      </p>
    </section>
  );
}
