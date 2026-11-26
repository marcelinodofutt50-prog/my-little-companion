import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Headset, Users, BadgeCheck, Trophy, Clock } from "lucide-react";
import { getTrustStats } from "@/lib/trust.functions";

const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function sinceLabel(desde: string): string {
  const [y, m] = (desde || "").split("-");
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return "";
  return `${MONTHS[mi]}/${y}`;
}
const fmt = (n: number) => n.toLocaleString("pt-BR");

export function TrustSection() {
  const statsFn = useServerFn(getTrustStats);
  const [s, setS] = useState<{ entregues: number; membros: number; desde: string } | null>(null);

  useEffect(() => {
    let on = true;
    statsFn().then((r) => { if (on) setS(r as any); }).catch(() => {});
    return () => { on = false; };
  }, [statsFn]);

  const stats = [
    s && s.entregues >= 100 ? { icon: BadgeCheck, big: `+${fmt(s.entregues)}`, label: "licenças entregues" } : null,
    s && s.membros >= 100 ? { icon: Users, big: `+${fmt(s.membros)}`, label: "membros na comunidade" } : null,
    s && s.desde ? { icon: Clock, big: sinceLabel(s.desde), label: "no ar desde" } : null,
  ].filter(Boolean) as { icon: typeof Users; big: string; label: string }[];

  const badges = [
    { icon: ShieldCheck, t: "Pagamento seguro", d: "Checkout em ambiente externo protegido." },
    { icon: Headset, t: "Suporte humano", d: "Gente de verdade te acompanha na ativação." },
    { icon: BadgeCheck, t: "Ativação pela equipe", d: "Sua licença é liberada e conferida por nós." },
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 py-14 md:py-16">
      <p className="text-sm font-semibold text-primary">Confiança</p>
      <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">
        Primeira vez? Relaxa — você está seguro.
      </h2>
      <p className="mt-2 max-w-xl text-muted-foreground">
        A gente sabe do medo de golpe. Por isso tudo aqui é transparente: muita gente já passou por esse processo, e você pode conferir por conta própria.
      </p>

      {stats.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {stats.map((st) => (
            <div key={st.label} className="rounded-2xl border border-border/50 bg-card/40 p-5">
              <st.icon className="mb-2 h-5 w-5 text-primary" />
              <div className="font-display text-3xl font-black tracking-tight text-primary">{st.big}</div>
              <div className="text-sm text-muted-foreground">{st.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {badges.map((b) => (
          <div key={b.t} className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card/40 p-5">
            <b.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <div className="font-semibold">{b.t}</div>
              <p className="mt-0.5 text-sm text-muted-foreground">{b.d}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-primary/25 bg-primary/[0.04] p-5 sm:flex-row sm:items-center">
        <Trophy className="h-6 w-6 shrink-0 text-primary" />
        <p className="flex-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Não acredita só na nossa palavra.</span> Veja o mural público de ganhadores e clientes reais da Shadow.
        </p>
        <Link
          to="/vencedores"
          className="shrink-0 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Ver o mural
        </Link>
      </div>
    </section>
  );
}
