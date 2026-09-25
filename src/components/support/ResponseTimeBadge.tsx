import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Timer } from "lucide-react";
import { getSupportResponseStats } from "@/lib/support.functions";

function fmt(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export function ResponseTimeBadge() {
  const fn = useServerFn(getSupportResponseStats);
  const [s, setS] = useState<{ hours: number; avgMinutes: number | null; samples: number } | null>(null);
  useEffect(() => {
    let alive = true;
    fn().then((r: any) => alive && setS(r)).catch(() => {});
    return () => { alive = false; };
  }, [fn]);
  if (!s) return null;
  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
      <Timer className="h-3.5 w-3.5 text-primary" />
      {s.avgMinutes === null
        ? `Sem atendimentos medidos nas últimas ${s.hours}h`
        : <>Tempo médio de resposta da equipe nas últimas {s.hours}h: <b className="text-foreground">{fmt(s.avgMinutes)}</b></>}
    </div>
  );
}
