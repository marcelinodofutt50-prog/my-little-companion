import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, ShieldCheck, Zap, Clock } from "lucide-react";

export function SocialProofStrip() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count: total } = await supabase
        .from("orders" as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "paid");
      if (!cancelled) setCount(total ?? 0);
    })();
    return () => { cancelled = true; };
  }, []);

  const badges = [
    { icon: ShieldCheck, label: "Pagamento seguro", sub: "Mercado Pago + SSL" },
    { icon: Zap, label: "Ativação instantânea", sub: "Login em segundos" },
    { icon: Clock, label: "Suporte 24/7", sub: "Chat com atendente" },
    { icon: CheckCircle2, label: `${count.toLocaleString("pt-BR")}+ vendas`, sub: "Clientes ativos" },
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
