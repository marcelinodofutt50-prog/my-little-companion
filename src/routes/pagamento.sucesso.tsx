import { clearCheckoutIntent } from "@/components/WinbackOffer";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Copy, Eye, EyeOff, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getOrderState } from "@/lib/checkout.functions";

export const Route = createFileRoute("/pagamento/sucesso")({
  validateSearch: (s: Record<string, unknown>) => ({ order: String(s.order ?? "") }),
  head: () => ({
    meta: [
      { title: "Pagamento aprovado — Shadow" },
      { name: "description", content: "Seu pagamento foi confirmado. Estamos gerando a licença." },
      { property: "og:title", content: "Pagamento aprovado — Shadow" },
      { property: "og:description", content: "Seu pagamento foi confirmado. Estamos gerando a licença." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuccessPage,
});

type License = {
  id: string;
  yaarsa_username?: string | null;
  yaarsa_email?: string | null;
  password?: string | null;
  server_ip?: string | null;
  expires_at?: string | null;
};

const MAX_TRIES = 60; // ~2.5 min at 2.5s interval

function SuccessPage() {
  const { order } = Route.useSearch();
  const navigate = useNavigate();
  const [license, setLicense] = useState<License | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [tries, setTries] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [showIp, setShowIp] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const stateFn = useServerFn(getOrderState);
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
        if (r.license) {
          setLicense(r.license as License);
          return; // stop polling
        }
      } catch { /* transient network */ }
      if (n < MAX_TRIES) timerRef.current = window.setTimeout(tick, 2500);
      else setExhausted(true);
    };
    tick();
  };

  useEffect(() => {
    clearCheckoutIntent();
    if (!order) return;
    startPolling();

    return () => {
      stopped.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const copy = (label: string, value?: string | null) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => toast.success(`${label} copiado`));
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-14">
        <div className="terminal-card rgb-border scanlines relative p-8">
          {license ? (
            <>
              <CheckCircle2 className="mx-auto h-14 w-14 text-neon" />
              <h1 className="mt-3 text-center font-mono text-2xl font-bold text-neon">Licença gerada!</h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">Guarde estes dados. Eles também ficam no seu painel.</p>

              <div className="mt-6 space-y-2 text-sm">
                <Field label="Usuário" value={license.yaarsa_username} onCopy={() => copy("Usuário", license.yaarsa_username)} />
                <Field label="E-mail (login)" value={license.yaarsa_email} onCopy={() => copy("E-mail", license.yaarsa_email)} />
                <Field
                  label="Senha"
                  value={showPw ? license.password : license.password ? "•".repeat(Math.min(license.password.length, 12)) : ""}
                  onCopy={() => copy("Senha", license.password)}
                  action={
                    <button className="text-muted-foreground hover:text-neon" onClick={() => setShowPw((v) => !v)} aria-label="Mostrar senha">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <Field
                  label="Servidor"
                  value={showIp ? license.server_ip : license.server_ip ? "•••.•••.•••.•••" : ""}
                  onCopy={() => copy("Servidor", license.server_ip)}
                  action={
                    <button className="text-muted-foreground hover:text-neon" onClick={() => setShowIp((v) => !v)} aria-label="Mostrar servidor">
                      {showIp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Link to="/primeiros-passos" className="flex-1">
                  <Button className="w-full font-mono uppercase">
                    <Sparkles className="mr-2 h-4 w-4" /> Primeiros passos
                  </Button>
                </Link>
                <Button variant="outline" className="flex-1 font-mono uppercase" onClick={() => navigate({ to: "/dashboard" })}>
                  Ir para o painel
                </Button>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-neon" />
              <h2 className="mt-4 text-center font-mono text-xl">
                {exhausted ? "Ainda processando" : "Confirmando pagamento..."}
              </h2>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Status: <span className="font-mono text-cyan">{status}</span>
                {!exhausted && <span className="ml-2 text-xs opacity-70">tentativa {tries}/{MAX_TRIES}</span>}
              </p>

              {/* Progress bar */}
              <div className="mx-auto mt-4 h-1 w-full max-w-xs overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full bg-neon transition-all duration-500"
                  style={{ width: `${Math.min(100, (tries / MAX_TRIES) * 100)}%` }}
                />
              </div>

              {exhausted ? (
                <>
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    Se o pagamento já foi feito, ele será processado em instantes. Você pode verificar no painel a qualquer momento — a licença aparece assim que o pagamento é confirmado.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button className="flex-1 font-mono uppercase" onClick={startPolling}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Verificar de novo
                    </Button>
                    <Link to="/dashboard" className="flex-1">
                      <Button variant="outline" className="w-full font-mono uppercase">Ir para o painel</Button>
                    </Link>
                  </div>
                  <div className="mt-3 text-center">
                    <Link to="/suporte" className="text-xs text-cyan underline underline-offset-4 hover:opacity-80">Falar com suporte</Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Aguardando confirmação. Isto geralmente leva menos de 30 segundos.
                  </p>
                  <div className="mt-6 text-center">
                    <Link to="/dashboard">
                      <Button variant="outline" size="sm" className="font-mono uppercase">Ir para o painel</Button>
                    </Link>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({
  label, value, onCopy, action,
}: { label: string; value?: string | null; onCopy: () => void; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-primary/15 bg-background/50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="truncate font-mono text-sm">{value || "—"}</div>
      </div>
      <div className="flex items-center gap-2">
        {action}
        <button
          className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-neon disabled:opacity-40"
          onClick={onCopy}
          disabled={!value}
          aria-label={`Copiar ${label}`}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
