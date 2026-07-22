import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, ShieldCheck, Zap, Clock } from "lucide-react";

type Sale = {
  id: string;
  first_name: string;
  last_initial: string;
  plan_slug: string;
  amount: number;
  created_at: string;
};

const PLAN_LABEL: Record<string, string> = {
  "login-7d": "Plano Semanal",
  "login-30d": "Plano Mensal",
  "login-lifetime": "Plano Vitalício",
  "play-protect-monthly": "Play Protect",
  "upgrade-457-to-46": "Upgrade v4.6",
};

function planLabel(slug: string) {
  return PLAN_LABEL[slug] ?? slug;
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `há ${Math.floor(s)}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)}min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}

export function SocialProofStrip() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("public_recent_sales" as any)
        .select("*")
        .limit(10);
      if (!cancelled && data) setSales(data as unknown as Sale[]);
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

        {sales.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neon">// vendas recentes</div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {sales.map((s) => (
                <div key={s.id} className="flex-shrink-0 rounded border border-neon/20 bg-neon/5 px-3 py-2 font-mono text-[11px]">
                  <span className="text-neon">✓</span>{" "}
                  <span className="font-bold">{s.first_name}{s.last_initial ? ` ${s.last_initial}.` : ""}</span>
                  {" ativou "}
                  <span className="text-cyan">{planLabel(s.plan_slug)}</span>
                  <span className="ml-2 text-muted-foreground">{timeAgo(s.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
