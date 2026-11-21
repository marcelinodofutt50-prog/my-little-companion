import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import {
  getLifetimePromotion,
  getMyLifetimePromotion,
} from "@/lib/lifetime-promotion.functions";
import { LIFETIME_OFFER_PRICE_BRL } from "@/lib/lifetime-offer";
import welcomeOfferImage from "@/assets/vitalicio-novos-membros.jpg";

export const LIFETIME_PROMOTION_PRICE = LIFETIME_OFFER_PRICE_BRL;

export function useLifetimePromotion(enabled = true) {
  const query = useQuery({
    queryKey: ["my-lifetime-promotion"],
    queryFn: () => getMyLifetimePromotion(),
    enabled,
    staleTime: 30_000,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.active ? Math.min(60_000, data.remainingMs + 250) : false;
    },
  });
  return { active: Boolean(enabled && query.data?.active) };
}

export function LifetimePromotionBanner() {
  const query = useQuery({
    queryKey: ["lifetime-promotion-announcement"],
    queryFn: () => getLifetimePromotion(),
    staleTime: 5 * 60_000,
  });
  const [dismissed, setDismissed] = useState(false);
  if (!query.data?.active || dismissed) return null;

  return (
    <div className="relative border-b border-amber-400/30 bg-background">
      <Link
        to="/planos"
        aria-label="Ver oferta Vitalício de R$ 999,99 para novos membros nas primeiras 6 horas"
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      >
        <img
          src={welcomeOfferImage}
          alt="Oferta de boas-vindas: Vitalício por R$ 999,99, somente para novos membros nas primeiras 6 horas"
          width={1536}
          height={864}
          className="mx-auto h-auto max-h-72 w-full object-contain"
        />
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fechar aviso"
        className="absolute right-3 top-3 rounded-full border border-border bg-background/80 p-2 text-foreground backdrop-blur transition-colors hover:bg-background"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
