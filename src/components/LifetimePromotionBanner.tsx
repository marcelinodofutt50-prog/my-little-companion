import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { getLifetimePromotion } from "@/lib/lifetime-promotion.functions";
import {
  LIFETIME_OFFER_PRICE_BRL,
  LIFETIME_OFFER_REGULAR_PRICE_BRL,
} from "@/lib/lifetime-offer";

export const LIFETIME_PROMOTION_PRICE = LIFETIME_OFFER_PRICE_BRL;

export function useLifetimePromotion(enabled = true) {
  const query = useQuery({
    queryKey: ["lifetime-promotion"],
    queryFn: () => getLifetimePromotion(),
    enabled,
    staleTime: 5 * 60_000,
  });
  return { active: Boolean(enabled && query.data?.active) };
}

export function LifetimePromotionBanner() {
  const { active } = useLifetimePromotion();
  const [dismissed, setDismissed] = useState(false);
  if (!active || dismissed) return null;

  return (
    <div className="border-b border-amber-400/40 bg-amber-950 px-4 py-2.5 text-amber-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:flex-nowrap">
        <p className="text-center text-sm font-semibold" role="status">
          Vitalício de <s>R$ {LIFETIME_OFFER_REGULAR_PRICE_BRL.toLocaleString("pt-BR")}</s> por{" "}
          <strong>R$ 999,99</strong> na Cakto.
        </p>
        <Link to="/planos" className="rounded-md bg-amber-300 px-3 py-1.5 text-sm font-bold text-amber-950 hover:bg-amber-200">
          Ver oferta
        </Link>
        <button type="button" onClick={() => setDismissed(true)} aria-label="Fechar aviso" className="rounded-md p-1.5 hover:bg-white/10">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
