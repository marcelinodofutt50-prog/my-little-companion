import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { getLifetimePromotion } from "@/lib/lifetime-promotion.functions";

export const LIFETIME_PROMOTION_PRICE = 999;

export function useLifetimePromotion(enabled = true) {
  const query = useQuery({
    queryKey: ["lifetime-promotion"],
    queryFn: () => getLifetimePromotion(),
    enabled,
    staleTime: 0,
    refetchInterval: (query) => {
      const schedule = query.state.data;
      if (!schedule) return 60_000;
      const now = schedule.now + (Date.now() - query.state.dataUpdatedAt);
      if (now >= schedule.endsAt) return 60 * 60_000;
      const next = now < schedule.startsAt ? schedule.startsAt : schedule.endsAt;
      return Math.min(60_000, Math.max(1000, next - now + 250));
    },
  });
  const { data, dataUpdatedAt } = query;
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || !data) return;
    const tick = () => setClock(Date.now());
    tick();
    const interval = window.setInterval(tick, data.active ? 1000 : 5000);
    return () => window.clearInterval(interval);
  }, [data, enabled]);

  const now = data ? data.now + Math.max(0, clock - dataUpdatedAt) : 0;
  return {
    active: Boolean(enabled && data?.active && now < data.endsAt),
    endsAt: data?.endsAt ?? 0,
    remaining: data ? Math.max(0, Math.ceil((data.endsAt - now) / 1000)) : 0,
  };
}

export function LifetimePromotionBanner() {
  const { active, endsAt, remaining } = useLifetimePromotion();
  const [dismissed, setDismissed] = useState(0);
  if (!active || dismissed === endsAt) return null;
  const timer = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <div className="border-b border-amber-400/40 bg-amber-950 px-4 py-2.5 text-amber-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:flex-nowrap">
        <p className="text-center text-sm font-semibold" role="status">
          Corra! Vitalício de <s>R$ 1.700</s> por <strong>R$ 999</strong>. Disponível por uma hora.
        </p>
        <span className="font-mono text-sm tabular-nums" aria-label="Tempo restante">{timer}</span>
        <Link to="/planos" className="rounded-md bg-amber-300 px-3 py-1.5 text-sm font-bold text-amber-950 hover:bg-amber-200">
          Ver oferta
        </Link>
        <button type="button" onClick={() => setDismissed(endsAt)} aria-label="Fechar aviso" className="rounded-md p-1.5 hover:bg-white/10">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
