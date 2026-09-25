import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";
import { adminSupportStats } from "@/lib/support-admin.functions";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";

type Stats = Awaited<ReturnType<typeof adminSupportStats>>;

export function SupportStatsPanel() {
  const fn = useServerFn(adminSupportStats);
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fn().then((r) => alive && setS(r)).catch((e) => alive && setErr(e?.message || "Falha"));
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [fn]);
  if (err) return <div className="rounded-xl border border-destructive/50 p-4 text-sm text-destructive">{err}</div>;
  if (!s) return <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando estatísticas…</div>;
  const kpis = [
    ["Resposta média 24h", s.avgMinutes === null ? "—" : s.avgMinutes >= 60 ? `${(s.avgMinutes / 60).toFixed(1)} h` : `${s.avgMinutes} min`],
    ["Aguardando resposta", String(s.waitingNow)],
    ["Lidas", String(s.status.lidas)],
    ["Não vistas pela equipe", String(s.status.naoLidasPelaEquipe)],
    ["Cliente não viu", String(s.status.naoLidasPeloCliente)],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {kpis.map(([l, v]) => (
          <div key={l} className="rounded-xl border border-border/60 bg-card/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border/60 bg-card/60 p-3">
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Mensagens por hora (24h)</div>
        <ChartContainer
          className="h-56 w-full"
          config={{ clientes: { label: "Clientes", color: "hsl(var(--primary))" }, equipe: { label: "Equipe", color: "hsl(var(--accent))" } }}
        >
          <BarChart data={s.hourly}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={10} interval={2} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} width={24} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="clientes" stackId="a" fill="var(--color-clientes)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="equipe" stackId="a" fill="var(--color-equipe)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
