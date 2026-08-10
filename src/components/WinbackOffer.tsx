import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, TicketPercent, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWinbackOffer, dismissWinbackOffer } from "@/lib/winback.functions";

const KEY = "shadow_checkout_intent";

type Intent = { planSlug: string; ts: number };

/** Chamado logo antes de mandar o cliente para o checkout. */
export function markCheckoutIntent(planSlug: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ planSlug, ts: Date.now() } satisfies Intent));
  } catch { /* storage indisponível */ }
}

export function clearCheckoutIntent() {
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
}

function readIntent(): Intent | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Intent;
    if (!v?.planSlug) return null;
    // Intenção velha (mais de 24h) não vale mais.
    if (Date.now() - Number(v.ts ?? 0) > 24 * 60 * 60 * 1000) return null;
    return v;
  } catch { return null; }
}

type Offer = {
  code: string;
  discountPct: number;
  expiresAt: string;
  label: string;
  planSlug: string;
  planName: string;
  priceBrl: number;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function WinbackOffer({
  onUseCoupon,
}: {
  onUseCoupon: (code: string, planSlug: string) => void;
}) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const checking = useRef(false);

  const offerFn = useServerFn(getWinbackOffer);
  const dismissFn = useServerFn(dismissWinbackOffer);

  const check = useCallback(async () => {
    if (checking.current || offer) return;
    const intent = readIntent();
    if (!intent) return;
    // Evita disparar no mesmo instante em que o cliente clicou em comprar.
    if (Date.now() - intent.ts < 6000) return;
    checking.current = true;
    try {
      const r = await offerFn({ data: { planSlug: intent.planSlug } });
      if (r.offer) setOffer(r.offer as Offer);
      else clearCheckoutIntent();
    } catch { /* silencioso: é uma oferta, não um fluxo crítico */ }
    finally { checking.current = false; }
  }, [offerFn, offer]);

  useEffect(() => {
    const t = setTimeout(check, 1200);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", check);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", check);
    };
  }, [check]);

  // Contagem regressiva de urgência.
  useEffect(() => {
    if (!offer) return;
    const tick = () => {
      const ms = new Date(offer.expiresAt).getTime() - Date.now();
      setLeft(Math.max(0, Math.floor(ms / 1000)));
      if (ms <= 0) { setOffer(null); clearCheckoutIntent(); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [offer]);

  async function decline() {
    if (!offer) return;
    setBusy(true);
    const code = offer.code;
    setOffer(null);
    clearCheckoutIntent();
    try { await dismissFn({ data: { code } }); } catch { /* noop */ }
    setBusy(false);
  }

  function accept() {
    if (!offer) return;
    const { code, planSlug } = offer;
    clearCheckoutIntent();
    setOffer(null);
    toast.success(`Cupom ${code} aplicado`);
    onUseCoupon(code, planSlug);
  }

  if (!offer) return null;

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const novo = offer.priceBrl * (1 - offer.discountPct / 100);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-background/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-primary/40 bg-card shadow-2xl">
        <button
          type="button"
          onClick={decline}
          disabled={busy}
          aria-label="Recusar desconto"
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-border/60 bg-primary/10 px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary">
            <TicketPercent className="h-4 w-4" />
            Oferta exclusiva — {offer.label}
          </div>
          <h2 className="mt-2 text-xl font-bold leading-tight">
            Espera! {offer.discountPct}% OFF no {offer.planName}
          </h2>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex items-baseline gap-3">
            <span className="text-sm text-muted-foreground line-through">{brl(offer.priceBrl)}</span>
            <span className="text-3xl font-bold text-primary">{brl(novo)}</span>
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              economize {brl(offer.priceBrl - novo)}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Expira em</span>
            <span className="font-mono font-semibold tabular-nums">{mm}:{ss}</span>
            <span className="ml-auto font-mono text-xs text-muted-foreground">{offer.code}</span>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Cupom pessoal, de uso único. Se você fechar no X, ele é apagado na hora e não volta.
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={accept} disabled={busy} className="w-full" size="lg">
              Usar cupom e finalizar compra
            </Button>
            <button
              type="button"
              onClick={decline}
              disabled={busy}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Não quero o desconto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
