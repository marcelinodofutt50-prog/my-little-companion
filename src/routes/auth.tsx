import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, LifeBuoy } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import shadowMark from "@/assets/shadow-mask.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { siteUrl } from "@/lib/site-url";
import { Lost2faHelp } from "@/components/Lost2faHelp";
import { logEmailEvent } from "@/lib/email-metrics.functions";


export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): {
    next?: string;
    code?: string;
    type?: string;
    error?: string;
  } => ({
    next: typeof s.next === "string" ? s.next : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  head: () => ({ meta: [{ title: "Login — Shadow" }] }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

const COOLDOWN_KEY = "shadow.auth.emailCooldownUntil";
const ATTEMPTS_KEY = "shadow.auth.emailAttempts";
const MAX_ATTEMPTS_PER_HOUR = 8;

function readCooldown(): number {
  if (typeof window === "undefined") return 0;
  const until = Number(window.localStorage.getItem(COOLDOWN_KEY) ?? 0);
  if (!until) return 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function writeCooldown(secs: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COOLDOWN_KEY, String(Date.now() + secs * 1000));
}

/** Conta tentativas de envio na última hora (evita queimar a cota do remetente). */
function bumpAttempts(): number {
  if (typeof window === "undefined") return 0;
  const now = Date.now();
  let list: number[] = [];
  try {
    list = JSON.parse(window.localStorage.getItem(ATTEMPTS_KEY) ?? "[]");
  } catch { list = []; }
  list = list.filter((t) => now - t < 3600_000);
  list.push(now);
  window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(list));
  return list.length;
}

function currentAttempts(): number {
  if (typeof window === "undefined") return 0;
  const now = Date.now();
  try {
    const list: number[] = JSON.parse(window.localStorage.getItem(ATTEMPTS_KEY) ?? "[]");
    return list.filter((t) => now - t < 3600_000).length;
  } catch { return 0; }
}

function AuthPage() {
  const { next, code, type } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [emailBlocked, setEmailBlocked] = useState(false);

  // Restaura o cooldown mesmo se o usuário recarregar a página.
  useEffect(() => {
    setCooldown(readCooldown());
  }, []);

  // Contagem regressiva quando o envio de e-mails está temporariamente bloqueado.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function startCooldown(secs: number) {
    writeCooldown(secs);
    setCooldown(secs);
  }

  /** Limpa travas locais após sucesso (evita cliente preso em "Aguarde Xs"). */
  function clearLocalLimits() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(COOLDOWN_KEY);
    window.localStorage.removeItem(ATTEMPTS_KEY);
    setCooldown(0);
  }

  // Processa links de confirmação de e-mail do Supabase (?code=...&type=signup).
  useEffect(() => {
    if (!code || !type) return;

    async function exchange() {
      setConfirmMessage("Confirmando seu e-mail, aguarde...");
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setConfirmMessage(null);
        toast.error(`Falha ao confirmar e-mail: ${error.message}`);
        return;
      }
      if (data.user) {
        toast.success("E-mail confirmado! Redirecionando...");
        navigate({ to: (next as any) || "/dashboard" });
      }
    }
    exchange();
  }, [code, type, navigate, next]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: (next as any) || "/dashboard" });
    });
  }, [navigate, next]);

  /** Envia telemetria de e-mail sem bloquear o fluxo do usuário. */
  function track(
    action: string,
    outcome: "sent" | "failed" | "rate_limited" | "blocked_local",
    extra?: { error?: string; retryAfter?: number; httpStatus?: number },
  ) {
    void logEmailEvent({ data: { action, outcome, email, ...extra } }).catch(() => {});
  }

  function handleAuthError(err: any, action: string) {
    const raw = String(err?.message ?? "");
    const status = err?.status ?? err?.code;
    const isRateLimit =
      status === 429 ||
      /rate limit|too many requests|over_email_send_rate_limit|security purposes/i.test(raw);

    if (isRateLimit) {
      const secs = Number(raw.match(/(\d+)\s*second/i)?.[1] ?? 90);
      startCooldown(secs);
      setSignupMessage(null);
      setEmailBlocked(true);
      track(action, "rate_limited", { error: raw, retryAfter: secs, httpStatus: 429 });
      toast.error(
        `Limite de envio de e-mails atingido. Aguarde ${secs}s — sua conta não foi perdida.`
      );
    } else if (/already registered|already been registered|user already/i.test(raw)) {
      toast.error("Este e-mail já tem conta. Use \"Entrar\" ou recupere o acesso.");
      setMode("in");
    } else if (/email not confirmed/i.test(raw)) {
      setEmailBlocked(true);
      toast.error("Confirme seu e-mail antes de entrar. Veja a caixa de entrada e o spam.");
    } else if (/invalid login credentials/i.test(raw)) {
      toast.error("E-mail ou senha incorretos.");
    } else {
      if (action !== "signin") track(action, "failed", { error: raw, httpStatus: Number(status) || undefined });
      toast.error(raw || "Não foi possível concluir. Tente novamente.");
    }
  }

  /** Fallback: reenvia o e-mail de confirmação com trava local de tentativas. */
  async function resendConfirmation() {
    if (resending || cooldown > 0) return;
    const parsedEmail = z.string().trim().email().safeParse(email);
    if (!parsedEmail.success) return toast.error("Digite seu e-mail acima para reenviar.");
    if (currentAttempts() >= MAX_ATTEMPTS_PER_HOUR) {
      startCooldown(300);
      track("resend", "blocked_local", { error: "local attempt cap reached" });
      return toast.error(
        "Você já pediu o e-mail várias vezes nesta hora. Use o link que já chegou (veja Spam/Promoções) ou fale com o suporte."
      );
    }
    setResending(true);
    try {
      bumpAttempts();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: parsedEmail.data,
        options: { emailRedirectTo: siteUrl() },
      });
      if (error) throw error;
      startCooldown(90);
      track("resend", "sent");
      toast.success("E-mail reenviado. Verifique também Spam e Promoções.");
    } catch (err: any) {
      handleAuthError(err, "resend");
    } finally {
      setResending(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    // O cooldown só vale para envio de e-mail (cadastro). Login nunca é bloqueado.
    if (mode === "up" && cooldown > 0) return;
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      if (mode === "up") {
        if (currentAttempts() >= MAX_ATTEMPTS_PER_HOUR) {
          startCooldown(120);
          setEmailBlocked(true);
          track("signup", "blocked_local", { error: "local attempt cap reached" });
          throw new Error(
            "Muitas tentativas de cadastro nesta hora. Aguarde alguns minutos ou fale com o suporte."
          );
        }
        bumpAttempts();
        const { error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: siteUrl() },
        });
        if (error) throw error;
        toast.success("Conta criada! Confirme seu e-mail.");
        setEmailBlocked(false);
        track("signup", "sent");
        setSignupMessage(
          "Enviamos um e-mail de confirmação para você.\n\n" +
          "1. Abra o Gmail (ou app de e-mail).\n" +
          "2. Procure por uma mensagem da Shadow.\n" +
          "3. Clique no botão laranja \"Confirmar e-mail\".\n" +
          "4. Você será logado automaticamente.\n\n" +
          "Se não achar, olhe na pasta Spam ou Promoções."
        );
        startCooldown(60);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        clearLocalLimits();
        navigate({ to: (next as any) || "/dashboard" });
      }
    } catch (err: any) {
      handleAuthError(err, mode === "up" ? "signup" : "signin");
    } finally { setLoading(false); }
  }




  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[var(--neon)] opacity-25 blur-2xl" />
          <img src={shadowMark} alt="Shadow" className="h-20 w-20 object-contain drop-shadow-[0_0_24px_rgba(201,168,76,0.55)]" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-neon/80">your shadow, everywhere</p>

        {confirmMessage && (
          <div className="mt-4 flex w-full items-center gap-2 rounded border border-neon/40 bg-neon/10 px-4 py-3 text-xs text-neon">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{confirmMessage}</span>
          </div>
        )}

        {signupMessage && (
          <div className="mt-4 flex w-full items-start gap-3 rounded border border-neon/40 bg-neon/10 px-4 py-4 text-xs text-neon whitespace-pre-line">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{signupMessage}</span>
          </div>
        )}

        <form onSubmit={submit} className="mt-8 w-full terminal-card scanlines relative space-y-4 p-6">
          <div>
            <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Senha</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "in" ? "current-password" : "new-password"} />
          </div>
          <Button type="submit" className="w-full font-mono uppercase tracking-wider" disabled={loading || cooldown > 0}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {cooldown > 0
              ? `Aguarde ${cooldown}s`
              : mode === "in" ? "Entrar" : "Criar conta"}
          </Button>
          {cooldown > 0 && (
            <p className="text-center font-mono text-[11px] text-muted-foreground">
              Limite temporário de envio de e-mails. Se você já recebeu o link, use-o — não precisa reenviar.
            </p>
          )}
        </form>

        {(emailBlocked || signupMessage) && (
          <div className="mt-4 w-full rounded border border-amber-400/40 bg-amber-400/5 p-4 text-xs">
            <p className="font-mono uppercase tracking-wider text-amber-400">Não recebeu o e-mail?</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>1. Verifique as pastas <strong>Spam</strong> e <strong>Promoções</strong>.</li>
              <li>2. Confira se digitou o e-mail corretamente.</li>
              <li>3. Reenvie apenas uma vez — reenvios seguidos bloqueiam o envio.</li>
            </ul>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full font-mono text-[11px] uppercase"
                disabled={resending || cooldown > 0}
                onClick={resendConfirmation}
              >
                {resending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar e-mail"}
              </Button>
              <Button asChild variant="ghost" className="w-full font-mono text-[11px] uppercase">
                <Link to="/contato">
                  <LifeBuoy className="mr-2 h-3 w-3" /> Ativar via suporte
                </Link>
              </Button>
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              Se o envio estiver instável, o suporte confirma sua conta manualmente — informe o e-mail cadastrado.
            </p>
          </div>
        )}

        <button className="mt-6 font-mono text-xs uppercase text-muted-foreground hover:text-neon" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Não tem conta? Registre-se" : "Já tem conta? Entrar"}
        </button>
        <Link to="/recuperar" className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-neon">
          Perdi o acesso ao meu e-mail → recuperar conta
        </Link>
        <Lost2faHelp className="mt-6 w-full" />
        <Link to="/" className="mt-3 text-xs text-muted-foreground hover:text-foreground">← Voltar ao início</Link>

      </main>
    </div>
  );
}
