import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getMarketOrderState } from "@/lib/market.functions";

export const Route = createFileRoute("/mercado/sucesso")({
  validateSearch: (s: Record<string, unknown>) => ({ order: String(s.order ?? "") }),
  head: () => ({ meta: [{ title: "Pagamento recebido — Mercado Shadow" }] }),
  component: MarketSuccess,
});

function MarketSuccess() {
  const { order } = Route.useSearch();
  const [status, setStatus] = useState("pending");
  const stateFn = useServerFn(getMarketOrderState);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let tries = 0;
    const poll = async () => {
      tries++;
      try {
        const r = await stateFn({ data: { orderId: order } });
        if (r.order) setStatus(r.order.status);
        if (r.order?.status === "paid") return;
      } catch {}
      if (tries < 30) timerRef.current = window.setTimeout(poll, 3000);
    };
    if (order) poll();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [order, stateFn]);

  const paid = status === "paid";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="terminal-card rgb-border scanlines relative p-10">
          {paid ? (
            <>
              <CheckCircle2 className="mx-auto h-16 w-16 text-neon" />
              <h1 className="mt-4 font-mono text-2xl font-bold text-neon">Pagamento confirmado!</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Recebemos seu pedido. Abra o <Link to="/suporte" className="text-neon underline">Suporte</Link> para
                receber a entrega do produto por um operador.
              </p>
              <Link to="/suporte"><Button className="mt-6 font-mono uppercase">Ir para o Suporte</Button></Link>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-neon" />
              <h1 className="mt-4 font-mono text-xl">Confirmando pagamento...</h1>
              <p className="mt-2 text-sm text-muted-foreground">Status atual: <span className="font-mono text-cyan">{status}</span></p>
              <Link to="/dashboard"><Button variant="outline" className="mt-6 font-mono uppercase">Ir para o painel</Button></Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
