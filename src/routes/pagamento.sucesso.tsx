import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getOrderState } from "@/lib/checkout.functions";

export const Route = createFileRoute("/pagamento/sucesso")({
  validateSearch: (s: Record<string, unknown>) => ({ order: String(s.order ?? "") }),
  head: () => ({ meta: [{ title: "Pagamento aprovado — Shadow" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  const { order } = Route.useSearch();
  const navigate = useNavigate();
  const [licensed, setLicensed] = useState(false);
  const [status, setStatus] = useState<string>("pending");
  const stateFn = useServerFn(getOrderState);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let tries = 0;
    const poll = async () => {
      tries++;
      try {
        const r = await stateFn({ data: { orderId: order } });
        if (r.order) setStatus(r.order.status);
        if (r.license) {
          setLicensed(true);
          setTimeout(() => navigate({ to: "/dashboard" }), 1500);
          return;
        }
      } catch {}
      if (tries < 40) timerRef.current = window.setTimeout(poll, 2500);
    };
    if (order) poll();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [order, stateFn, navigate]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="terminal-card rgb-border scanlines relative p-10">
          {licensed ? (
            <>
              <CheckCircle2 className="mx-auto h-16 w-16 text-neon" />
              <h1 className="mt-4 font-mono text-2xl font-bold text-neon">Licença gerada!</h1>
              <p className="mt-2 text-sm text-muted-foreground">Redirecionando para o painel...</p>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-neon" />
              <h1 className="mt-4 font-mono text-xl">Confirmando pagamento...</h1>
              <p className="mt-2 text-sm text-muted-foreground">Status atual: <span className="font-mono text-cyan">{status}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Aguardando confirmação do Mercado Pago. Isto leva alguns segundos.</p>
              <Link to="/dashboard"><Button variant="outline" className="mt-6 font-mono uppercase">Ir para o painel</Button></Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
