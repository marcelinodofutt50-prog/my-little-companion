import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clock, RefreshCw, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getOrderState, reconcileMyRecentOrders } from "@/lib/checkout.functions";

export const Route = createFileRoute("/pagamento/pendente")({
  validateSearch: (s: Record<string, unknown>) => ({ order: String(s.order ?? "") }),
  head: () => ({
    meta: [
      { title: "Pagamento pendente — Shadow" },
      { name: "description", content: "Aguardando compensação do PIX. A licença é liberada automaticamente." },
      { property: "og:title", content: "Pagamento pendente — Shadow" },
      { property: "og:description", content: "Aguardando compensação do PIX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PendingPage,
});

const MAX_TRIES = 80; // ~3.3 min

function PendingPage() {
  const { order } = Route.useSearch();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("pending");
  const [tries, setTries] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const stateFn = useServerFn(getOrderState);
  const reconcileFn = useServerFn(reconcileMyRecentOrders);
  const timerRef = useRef<number | null>(null);
  const stopped = useRef(false);

  const startPolling = () => {
    stopped.current = false;
    setExhausted(false);
    setTries(0);
    let n = 0;
    const tick = async () => {
      if (stopped.current) return;
      n++; setTries(n);
      try {
        const r = await stateFn({ data: { orderId: order } });
        if (r.order) setStatus(r.order.status);
        if (r.license || r.order?.status === "paid") {
          navigate({ to: "/pagamento/sucesso", search: { order } as any });
          return;
        }
      } catch { /* transient */ }
      // Fallback do cron: a cada ~10s forçamos a reconciliação do pedido,
      // garantindo a entrega mesmo sem agendador de alta frequência.
      if (n % 4 === 0) {
        try { await reconcileFn(); } catch { /* usuário deslogado ou transitório */ }
      }
      if (n < MAX_TRIES) timerRef.current = window.setTimeout(tick, 2500);
      else setExhausted(true);
    };
    tick();
  };

  useEffect(() => {
    if (!order) return;
    startPolling();
    return () => {
      stopped.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-14">
        <div className="terminal-card scanlines relative p-8 text-center">
          {exhausted ? <Clock className="mx-auto h-12 w-12 text-cyan" /> : <Loader2 className="mx-auto h-12 w-12 animate-spin text-cyan" />}
          <h1 className="mt-4 font-mono text-xl">
            {exhausted ? "Ainda aguardando" : "Aguardando compensação do PIX"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Status: <span className="font-mono text-cyan">{status}</span>
            {!exhausted && order && (
              <span className="ml-2 text-xs opacity-70">tentativa {tries}/{MAX_TRIES}</span>
            )}
          </p>

          {order && (
            <div className="mx-auto mt-4 h-1 w-full max-w-xs overflow-hidden rounded-full bg-primary/10">
              <div
                className="h-full bg-cyan transition-all duration-500"
                style={{ width: `${Math.min(100, (tries / MAX_TRIES) * 100)}%` }}
              />
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            Assim que o PIX for compensado (geralmente em segundos), a licença é liberada automaticamente e você é redirecionado.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {exhausted && order && (
              <Button className="font-mono uppercase" onClick={startPolling}>
                <RefreshCw className="mr-2 h-4 w-4" /> Verificar de novo
              </Button>
            )}
            <Link to="/dashboard">
              <Button variant="outline" className="font-mono uppercase">Ir para o painel</Button>
            </Link>
            <Link to="/suporte">
              <Button variant="ghost" className="font-mono uppercase">Falar com suporte</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
