import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Users, Clock, TrendingUp } from "lucide-react";

const PLAN_LABEL: Record<string, string> = {
  "login-7d": "Plano Semanal",
  "login-30d": "Plano Mensal",
  "login-lifetime": "Plano Vitalício",
  "play-protect-monthly": "Play Protect",
  "upgrade-457-to-46": "Upgrade v4.6",
};

/** Live viewer count — deterministic pseudo-random so it doesn't jump wildly. */
function useLiveViewers() {
  const [n, setN] = useState<number>(0);
  useEffect(() => {
    const seed = () => {
      const h = new Date().getHours();
      const base = h >= 20 || h < 2 ? 42 : h >= 12 ? 28 : 15;
      return base + Math.floor(Math.random() * 12);
    };
    setN(seed());
    const id = setInterval(() => setN((prev) => Math.max(8, prev + (Math.random() > 0.5 ? 1 : -1))), 8000);
    return () => clearInterval(id);
  }, []);
  return n;
}

/** Toast pop-ups showing recent purchases — pure social proof. */
export function LiveSalesToasts() {
  useEffect(() => {
    let cancelled = false;
    let shownIds = new Set<string>();
    let timer: number | undefined;

    async function tick() {
      if (cancelled) return;
      const { data } = await supabase
        .from("public_recent_sales" as any)
        .select("*")
        .limit(6);
      const sales = (data as any[] | null) ?? [];
      const fresh = sales.filter((s) => !shownIds.has(s.id));
      if (fresh.length) {
        const s = fresh[Math.floor(Math.random() * fresh.length)];
        shownIds.add(s.id);
        const who = `${s.first_name}${s.last_initial ? ` ${s.last_initial}.` : ""}`;
        toast.success(`${who} acabou de ativar ${PLAN_LABEL[s.plan_slug] ?? s.plan_slug}`, {
          duration: 4500,
          className: "font-mono text-xs",
        });
      }
      timer = window.setTimeout(tick, 18000 + Math.random() * 12000);
    }
    // First one after a short delay so it doesn't hit on the initial paint.
    timer = window.setTimeout(tick, 6000);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);
  return null;
}

/** Live viewers + guarantee strip for the plans page. */
export function ConversionBoosters() {
  const viewers = useLiveViewers();
  return (
    <section className="mb-8 grid gap-3 md:grid-cols-3">
      <div className="flex items-center gap-3 rounded-lg border border-neon/30 bg-neon/5 p-3">
        <Users className="h-5 w-5 text-neon" />
        <div className="min-w-0">
          <div className="font-mono text-xs font-bold text-neon">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon align-middle" />{" "}
            {viewers} pessoas vendo os planos agora
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">demanda alta — ative logo</div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-cyan/30 bg-cyan/5 p-3">
        <ShieldCheck className="h-5 w-5 text-cyan" />
        <div className="min-w-0">
          <div className="font-mono text-xs font-bold text-cyan">Garantia de reembolso</div>
          <div className="font-mono text-[10px] text-muted-foreground">se a licença falhar, devolvemos 100%</div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-violet/30 bg-violet/5 p-3">
        <Clock className="h-5 w-5 text-violet" />
        <div className="min-w-0">
          <div className="font-mono text-xs font-bold text-violet">Ativação instantânea</div>
          <div className="font-mono text-[10px] text-muted-foreground">login entregue no chat em segundos</div>
        </div>
      </div>
    </section>
  );
}

/** Sticky mobile CTA. */
export function MobileStickyCTA({ label = "Ver planos", to = "/planos" as const }: { label?: string; to?: "/planos" | "/suporte" }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neon/40 bg-background/95 p-3 backdrop-blur md:hidden">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-5 w-5 flex-shrink-0 text-neon" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[11px] font-bold text-foreground">Comece agora</div>
          <div className="truncate font-mono text-[9px] text-muted-foreground">Ativação em segundos · garantia total</div>
        </div>
        <Link
          to={to}
          className="glow-neon flex-shrink-0 rounded-md bg-primary px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground"
        >
          {label}
        </Link>
      </div>
    </div>
  );
}
