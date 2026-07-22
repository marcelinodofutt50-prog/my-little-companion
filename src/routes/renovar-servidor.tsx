import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { createCheckout } from "@/lib/checkout.functions";
import { checkLegacyEmail } from "@/lib/license.functions";
import { formatBrl } from "@/lib/plans";

export const Route = createFileRoute("/renovar-servidor")({
  head: () => ({
    meta: [
      { title: "Renovar Servidor · Cliente Antigo — Shadow" },
      { name: "description", content: "Renove seu servidor Shadow por R$ 250/mês. Vinculamos seu login existente e realinhamos o vencimento para o próximo dia 20." },
    ],
  }),
  component: LegacyRenewalPage,
});

type Panel = "v457" | "v46";

function LegacyRenewalPage() {
  const navigate = useNavigate();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ip, setIp] = useState("");
  const [panel, setPanel] = useState<Panel | "">("");
  const [foundPanels, setFoundPanels] = useState<Panel[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [going, setGoing] = useState(false);

  const lookupFn = useServerFn(checkLegacyEmail);
  const checkoutFn = useServerFn(createCheckout);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
  }, []);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // IPv4 (0-255 por octeto) ou IPv6 simples (hex + :)
  const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  const IPV6_RE = /^([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  const isValidIp = (v: string) => IPV4_RE.test(v) || IPV6_RE.test(v);

  async function verifyEmail() {
    setErr(null); setFoundPanels(null); setPanel("");
    const clean = email.trim().toLowerCase();
    if (!clean) return setErr("Informe seu email");
    if (!EMAIL_RE.test(clean)) return setErr("Email inválido — use o formato nome@dominio.com");
    setChecking(true);
    try {
      const r = await lookupFn({ data: { email: clean } });
      if (!r.found) {
        setErr("Email não encontrado em nenhum painel. Se você é cliente novo, escolha um plano em /planos.");
        return;
      }
      const panels = r.panels as Panel[];
      setFoundPanels(panels);
      if (panels.length === 1) setPanel(panels[0]);
    } catch (e: any) {
      setErr(e?.message || "Falha ao verificar");
    } finally {
      setChecking(false);
    }
  }

  async function goCheckout() {
    setErr(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();
    const cleanIp = ip.trim();

    if (!cleanEmail) return setErr("Informe seu email");
    if (!EMAIL_RE.test(cleanEmail)) return setErr("Email inválido — use o formato nome@dominio.com");
    if (!foundPanels || foundPanels.length === 0) return setErr("Verifique seu email antes de continuar");
    if (!panel) return setErr("Confirme o painel encontrado");
    if (!cleanPass) return setErr("Informe sua senha atual do painel");
    if (cleanPass.length < 4) return setErr("A senha parece curta demais — confira e tente novamente");
    if (cleanPass.length > 64) return setErr("Senha muito longa (máx. 64 caracteres)");
    if (!cleanIp) return setErr("Informe o IP do seu servidor");
    if (!isValidIp(cleanIp)) return setErr("IP inválido — use um IPv4 (ex: 191.96.78.81) ou IPv6 válido");

    setGoing(true);
    try {
      const r = await checkoutFn({
        data: {
          planSlug: "server-monthly-legacy",
          returnOrigin: window.location.origin,
          legacyClaim: { email: cleanEmail, password: cleanPass, ip: cleanIp, panel },
        },
      });
      window.location.href = r.initPoint;
    } catch (e: any) {
      setErr(e?.message || "Falha ao iniciar checkout");
      setGoing(false);
    }
  }


  if (loggedIn === false) {
    return (
      <div className="relative min-h-screen">
        <SiteHeader />
        <main className="relative z-10 mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-muted-foreground">
            Faça <Link to="/auth" className="text-neon underline">login</Link> para renovar o servidor.
          </p>
        </main>
      </div>
    );
  }

  const panelLabel = (p: Panel) => (p === "v46" ? "Shadow 4.6 (Vitalício)" : "Shadow 4.5.7 (Mensal)");

  return (
    <div className="relative min-h-screen">
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// server renewal · legacy</div>
          <h1 className="mt-2 text-3xl font-bold">Renovar Servidor · Cliente Antigo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Taxa fixa <span className="font-mono text-cyan">{formatBrl(250)}</span> — vencimento realinhado para o próximo dia 20 após o pagamento.
          </p>
        </div>

        <div className="terminal-card scanlines relative space-y-5 p-6">
          {/* Step 1 — email */}
          <section>
            <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="rounded bg-cyan/10 px-1.5 py-0.5 text-cyan">1</span> Email do seu login
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFoundPanels(null); setPanel(""); setErr(null); }}
                placeholder="seu@email.com"
                className="font-mono"
                disabled={going}
              />
              <Button variant="outline" onClick={verifyEmail} disabled={checking || going} className="whitespace-nowrap font-mono uppercase">
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
              </Button>
            </div>
            {foundPanels && foundPanels.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <CheckCircle2 className="h-4 w-4 text-neon" />
                <span className="text-neon">Login encontrado em:</span>
                {foundPanels.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPanel(p)}
                    disabled={going}
                    className={`rounded border px-2 py-0.5 font-mono text-[11px] uppercase ${panel === p ? "border-neon bg-neon/20 text-neon" : "border-border/50 text-muted-foreground hover:border-neon/40"}`}
                  >
                    {panelLabel(p)}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Step 2 — password + ip (só depois do lookup ok) */}
          {foundPanels && foundPanels.length > 0 && (
            <>
              <section>
                <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span className="rounded bg-cyan/10 px-1.5 py-0.5 text-cyan">2</span> Sua senha atual do painel
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErr(null); }}
                  placeholder="Senha do login"
                  className="font-mono"
                  autoComplete="off"
                  disabled={going}
                />
                <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-neon" /> Armazenamos criptografada — usada apenas para restaurar seu acesso.
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span className="rounded bg-cyan/10 px-1.5 py-0.5 text-cyan">3</span> IP do seu servidor
                </div>
                <Input
                  value={ip}
                  onChange={(e) => { setIp(e.target.value); setErr(null); }}
                  placeholder="ex: 191.96.78.81"
                  className="font-mono"
                  disabled={going}
                />
              </section>

              {err && (
                <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4" /> {err}
                </div>
              )}

              <div className="rounded border border-cyan/20 bg-cyan/5 p-3 font-mono text-[11px] text-cyan/80">
                Após o pagamento confirmado, a IA revisa a licença, estende o vencimento no painel e libera o servidor até o próximo dia 20.
              </div>

              <Button
                onClick={goCheckout}
                disabled={going || !panel || !password.trim() || !ip.trim()}
                className="w-full font-mono uppercase tracking-wider"
              >
                {going ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Ir para pagamento · {formatBrl(250)}
              </Button>
            </>
          )}

          {err && (!foundPanels || foundPanels.length === 0) && (
            <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4" /> {err}
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Cliente novo? <button onClick={() => navigate({ to: "/planos" })} className="text-neon hover:underline">Ver planos</button>
        </div>
      </main>
    </div>
  );
}
