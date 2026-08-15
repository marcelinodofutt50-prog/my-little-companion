import { useEffect, useState } from "react";
import { getPaidOrdersCount } from "@/lib/social-proof.functions";
import { CheckCircle2, ShieldCheck, Zap, Clock } from "lucide-react";

export function SocialProofStrip() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await getPaidOrdersCount();
        if (!cancelled && typeof res?.count === "number") setCount(res.count);
      } catch {
        // leitura pública indisponível — mantém o selo estático
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const badges = [
    { icon: ShieldCheck, label: "Pagamento seguro", sub: "Mercado Pago + SSL" },
    { icon: Zap, label: "Ativação instantânea", sub: "Login em segundos" },
    { icon: Clock, label: "Suporte 24/7", sub: "Chat com atendente" },
    count !== null
      ? { icon: CheckCircle2, label: `${count.toLocaleString("pt-BR")}+ vendas`, sub: "Clientes ativos" }
      : { icon: CheckCircle2, label: "Entrega automática", sub: "Login na hora do pagamento" },
  ];


  return (
    <section className="border-y border-border/40 bg-card/30 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {badges.map((b) => (
            <div key={b.label} className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/40 p-3">
              <b.icon className="h-8 w-8 flex-shrink-0 text-neon" />
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold uppercase text-foreground">{b.label}</div>
                <div className="truncate font-mono text-[10px] text-muted-foreground">{b.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
