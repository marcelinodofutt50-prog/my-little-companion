import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, LifeBuoy, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { siteUrl } from "@/lib/site-url";
import { Lost2faHelp } from "@/components/Lost2faHelp";
import { logEmailEvent } from "@/lib/email-metrics.functions";
import { checkSignupAllowed, recordSignupIp } from "@/lib/antifraud.functions";
import { checkEmailAvailability, confirmFreshSignupEmail, createAccountWhenEmailBlocked } from "@/lib/signup.functions";
import { checkAuthSecurity, reportAuthOutcome } from "@/lib/security.functions";


export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): {
    next?: string;
    code?: string;
    type?: string;
    error?: string;
    trial?: string;
    mode?: string;
  } => ({
    next: typeof s.next === "string" ? s.next : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
    trial: typeof s.trial === "string" ? s.trial : undefined,
    mode: typeof s.mode === "string" ? s.mode : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Login — Shadow" },
      { name: "description", content: "Acesse sua conta Shadow ou crie uma nova. Painel de licenças, downloads, suporte e renovação." },
      { property: "og:title", content: "Login — Shadow" },
      { property: "og:description", content: "Acesse sua conta Shadow ou crie uma nova para gerenciar licenças e suporte." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/auth") },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: siteUrl("/auth") }],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

/** Travas locais são por usuário (e-mail): cada e-mail tem seu próprio cooldown. */
const COOLDOWN_KEY = "shadow.auth.emailCooldownUntil";
const ATTEMPTS_KEY = "shadow.auth.emailAttempts";
const MAX_ATTEMPTS_PER_HOUR = 8;
/** Trava local nunca passa de 60s: o limite real do servidor já foi ampliado. */
const MAX_COOLDOWN_SECS = 60;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function keyFor(base: string, email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return `${base}:${normalized}`;
}

function readCooldown(email: string): number {
  if (typeof window === "undefined") return 0;
  const key = keyFor(COOLDOWN_KEY, email);
  if (!key) return 0;
  const until = Number(window.localStorage.getItem(key) ?? 0);
  if (!until) return 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function writeCooldown(email: string, secs: number) {
  if (typeof window === "undefined") return;
  const key = keyFor(COOLDOWN_KEY, email);
  if (!key) return;
  window.localStorage.setItem(key, String(Date.now() + secs * 1000));
}

/** Conta tentativas de envio na última hora para o e-mail informado. */
function bumpAttempts(email: string): number {
  if (typeof window === "undefined") return 0;
  const key = keyFor(ATTEMPTS_KEY, email);
  if (!key) return 0;
  const now = Date.now();
  let list: number[] = [];
  try {
    list = JSON.parse(window.localStorage.getItem(key) ?? "[]");
  } catch { list = []; }
  list = list.filter((t) => now - t < 3600_000);
  list.push(now);
  window.localStorage.setItem(key, JSON.stringify(list));
  return list.length;
}

/** Tentativas de envio na última hora + horário do último envio (para o status). */
function attemptsInfo(email: string): { count: number; last: number | null } {
  if (typeof window === "undefined") return { count: 0, last: null };
  const key = keyFor(ATTEMPTS_KEY, email);
  if (!key) return { count: 0, last: null };
  const now = Date.now();
  try {
    const list: number[] = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    const recent = list.filter((t) => now - t < 3600_000);
    return { count: recent.length, last: recent.length ? recent[recent.length - 1] : null };
  } catch { return { count: 0, last: null }; }
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function AuthPage() {
  const shadowMark = "/assets/shadow-mark-v8.png?v=v8-400";
  const { next, code, type, trial } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [emailBlocked, setEmailBlocked] = useState(false);
  const [sendInfo, setSendInfo] = useState<{ count: number; last: number | null }>({ count: 0, last: null });
  /** true quando o e-mail digitado já pertence a uma conta (inclui alias do Gmail). */
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  /** bloqueio temporário por excesso de tentativas de cadastro (rate limit do servidor). */
  const [signupBlockUntil, setSignupBlockUntil] = useState<number | null>(null);
  const [signupBlockSecs, setSignupBlockSecs] = useState(0);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!signupBlockUntil) return setSignupBlockSecs(0);
    const tick = () => {
      const secs = Math.max(0, Math.ceil((signupBlockUntil - Date.now()) / 1000));
      setSignupBlockSecs(secs);
      if (secs === 0) setSignupBlockUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [signupBlockUntil]);

  // Digitou outro e-mail? o aviso de "já cadastrado" some.
  useEffect(() => { setEmailTaken(false); }, [email]);

  /** Checagem ao sair do campo, só no cadastro: evita erro depois de preencher tudo. */
  async function verifyEmailFree() {
    if (mode !== "up") return;
    const clean = normalizeEmail(email);
    if (!z.string().email().safeParse(clean).success) return;
    setCheckingEmail(true);
    try {
      const r = await checkEmailAvailability({ data: { email: clean } });
      setEmailTaken(!r.available);
    } catch { /* checagem é só conveniência */ }
    finally { setCheckingEmail(false); }
  }

  // Cooldown e histórico são por e-mail: trocar de e-mail mostra o estado do novo usuário.
  useEffect(() => {
    setCooldown(readCooldown(email));
    setSendInfo(attemptsInfo(email));
  }, [email]);


  // Contagem regressiva quando o envio de e-mails está temporariamente bloqueado.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function startCooldown(secs: number) {
    const capped = Math.min(Math.max(1, secs), MAX_COOLDOWN_SECS);
    writeCooldown(email, capped);
    setCooldown(capped);
  }

  /** Limpa travas locais do e-mail atual após sucesso (evita cliente preso em "Aguarde Xs"). */
  function clearLocalLimits() {
    if (typeof window === "undefined") return;
    const cd = keyFor(COOLDOWN_KEY, email);
    const at = keyFor(ATTEMPTS_KEY, email);
    if (cd) window.localStorage.removeItem(cd);
    if (at) window.localStorage.removeItem(at);
    setCooldown(0);
    setEmailBlocked(false);
    setSendInfo({ count: 0, last: null });
  }



  // Processa links de confirmação de e-mail do Supabase (?code=...&type=signup).
  useEffect(() => {
    if (!code || !type || typeof code !== 'string') return;

    async function exchange() {
      setConfirmMessage("Confirmando seu e-mail, aguarde...");
      if (!code || !type) return;
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setConfirmMessage(null);
        toast.error(`Falha ao confirmar e-mail: ${error.message}`);
        return;
      }
      if (data.user) {
        toast.success("E-mail confirmado! Redirecionando...");
        navigate({ to: (next as any) || "/dashboard", search: {} as any });
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
        `Muitos e-mails enviados. Aguarde ${secs}s antes de pedir outro reenvio. Você já pode usar o painel normalmente.`
      );
    } else if (/already registered|already been registered|user already/i.test(raw)) {
      toast.error("Este e-mail já tem conta. Use \"Entrar\" ou recupere o acesso.");
      setMode("in");
    } else if (/email not confirmed/i.test(raw)) {
      setEmailBlocked(true);
      toast.error("Confirme seu e-mail antes de entrar. Veja a caixa de entrada e o spam.");
    } else if (/invalid login credentials/i.test(raw)) {
      toast.error("E-mail ou senha incorretos.");
    } else if (/IP_HASH_SALT|hash salt|não configurado|not configured|PGRST|schema cache|env(ironment)? var/i.test(raw)) {
      // Erro técnico de configuração: nunca mostrar detalhes internos ao cliente.
      if (action !== "signin") track(action, "failed", { error: raw, httpStatus: Number(status) || undefined });
      toast.error(
        "Não conseguimos validar sua conexão agora (navegação anônima ou bloqueadores podem causar isso). Tente em uma aba normal do navegador ou fale com o suporte.",
      );
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
    
    // Se o envio falhar por rate limit, liberamos manualmente via server function.
    setResending(true);
    try {
      bumpAttempts(email);
      setSendInfo(attemptsInfo(email));
      
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: parsedEmail.data,
        options: { emailRedirectTo: siteUrl() },
      });

      if (error) {
        const raw = String(error.message ?? "");
        const isRateLimit = (error as any)?.status === 429 || /rate limit|too many requests|over_email_send_rate_limit/i.test(raw);
        
        if (isRateLimit) {
           const freed = await confirmFreshSignupEmail({ data: { email: parsedEmail.data } }).catch(() => ({ ok: false }) as any);
           if (freed?.ok) {
             toast.success("E-mail liberado! Você já pode entrar agora.");
             clearLocalLimits();
             setMode("in");
             return;
           }
        }
        throw error;
      }

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
    if (mode === "up" && signupBlockSecs > 0) {
      return toast.error(`Muitas tentativas. Aguarde ${signupBlockSecs}s para tentar de novo.`);
    }
    const cleanEmail = normalizeEmail(email);
    const parsed = schema.safeParse({ email: cleanEmail, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      setSecurityNotice(null);

      // Login e cadastro usam a mesma proteção e o mesmo hash server-side.
      // Se o segredo obrigatório estiver ausente, o backend bloqueia de forma
      // controlada sem revelar nomes, valores ou detalhes internos ao cliente.
      const security = await checkAuthSecurity({
        data: { email: cleanEmail, action: mode === "up" ? "signup" : "login" },
      });
      setSecurityNotice("warning" in security ? (security.warning ?? null) : null);
      if (!security.allowed) {
        toast.error(security.message);
        return;
      }

      if (mode === "up") {
        // 1) Mesma caixa de entrada já cadastrada? (cobre alias do Gmail: pontos e +tag)
        const avail = await checkEmailAvailability({ data: { email: cleanEmail } })
          .catch(() => ({ available: true }) as any);
        if (!avail.available) {
          setMode("in");
          setEmailTaken(true);
          toast.error(
            avail.reason === "alias"
              ? `Este Gmail já tem conta (${avail.aliasOf ?? "cadastrada"}). Pontos e "+" são ignorados pelo Gmail — use "Entrar".`
              : "Este e-mail já tem conta. Use \"Entrar\" ou recupere o acesso.",
          );
          return;
        }
        // 2) Antifraude: rate limit de tentativas + limite de contas por conexão (IP em hash).
        const guard = await checkSignupAllowed({ data: { email: cleanEmail } })
          .catch(() => ({ allowed: true }) as any);
        if (!guard.allowed) {
          if (guard.retryAfter) {
            setSignupBlockUntil(Date.now() + guard.retryAfter * 1000);
          }
          throw new Error(guard.reason ?? "Cadastro bloqueado por segurança. Fale com o suporte.");
        }
        setSignupBlockUntil(null);
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: cleanEmail, password, options: { emailRedirectTo: siteUrl() },
        });

        // Falha de ENVIO de e-mail (limite atingido) não pode impedir a venda:
        // criamos a conta pelo servidor e seguimos direto pro painel.
        if (error) {
          const raw = String(error.message ?? "");
          const emailIssue =
            (error as any)?.status === 429 ||
            /rate limit|too many requests|over_email_send_rate_limit|sending confirmation|error sending|smtp/i.test(raw);
          if (!emailIssue) throw error;

          const fb = await createAccountWhenEmailBlocked({ data: { email: cleanEmail, password } })
            .catch(() => ({ ok: false }) as any);
          if (fb?.exists) {
            setMode("in");
            setEmailTaken(true);
            toast.error("Este e-mail já tem conta. Use \"Entrar\" ou recupere o acesso.");
            return;
          }
          if (!fb?.ok) throw error;

          await recordSignupIp({ data: { email: cleanEmail, userId: null } }).catch(() => {});
          clearLocalLimits();
          track("signup", "sent");
          const { error: fbSignIn } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
          if (fbSignIn) throw fbSignIn;
          toast.success("Conta criada! Bem-vindo.");
          navigate({ to: (next as any) || "/dashboard", search: { trial: trial === 'true' ? 'true' : undefined } as any });




          return;
        }
        // O Supabase devolve um usuário "fantasma" (sem identities) quando o e-mail
        // já existe, para não vazar cadastro. Tratamos como duplicado.
        if (signUpData.user && (signUpData.user.identities?.length ?? 0) === 0) {
          setMode("in");
          setEmailTaken(true);
          toast.error("Este e-mail já tem conta. Use \"Entrar\" ou recupere o acesso.");
          return;
        }
        // await: o fire-and-forget podia perder o registro se a página navegasse logo após o cadastro.
        await recordSignupIp({ data: { email: cleanEmail, userId: signUpData.user?.id ?? null } }).catch(() => {});
        clearLocalLimits();
        track("signup", "sent");
        // Entra direto no painel: a confirmação de e-mail é feita depois, pelo banner do dashboard.
        if (signUpData.session) {
          toast.success("Conta criada! Bem-vindo.");
          navigate({ to: (next as any) || "/dashboard", search: { trial: trial === 'true' ? 'true' : undefined } as any });




          return;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (!signInError) {
          toast.success("Conta criada! Bem-vindo.");
          navigate({ to: (next as any) || "/dashboard", search: { trial: trial === 'true' ? 'true' : undefined } as any });




          return;
        }

        // Se o Supabase ainda travar por e-mail não confirmado após o signup, liberamos.
        if (/email not confirmed|not confirmed/i.test(signInError.message ?? "")) {
          const freed = await confirmFreshSignupEmail({ data: { email: cleanEmail } }).catch(() => ({ ok: false }) as any);
          if (freed?.ok) {
            const retry = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
            if (!retry.error) {
              toast.success("Conta criada e liberada! Bem-vindo.");
              navigate({ to: (next as any) || "/dashboard", search: { trial: trial === 'true' ? 'true' : undefined } as any });




              return;
            }
          }
        }

        toast.success("Conta criada! Redirecionando...");
        navigate({ to: (next as any) || "/dashboard", search: { trial: trial === 'true' ? 'true' : undefined } as any });

      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          void reportAuthOutcome({ data: { email: cleanEmail, action: "login", success: false } });
          throw error;
        }
        void reportAuthOutcome({ data: { email: cleanEmail, action: "login", success: true } });
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
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-14">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[var(--neon)] opacity-25 blur-2xl" />
          <img src={shadowMark} alt="Shadow" width={80} height={80} decoding="async" className="mx-auto block h-14 w-14 object-contain sm:h-20 sm:w-20 drop-shadow-[0_0_24px_rgba(201,168,76,0.6)] dark:drop-shadow-[0_0_24px_rgba(255,255,255,0.25)] brightness-110 contrast-110 dark:brightness-125 dark:contrast-125 light:mix-blend-multiply transition-all duration-300" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">
          {mode === "in" ? "Acesse sua conta" : "Crie sua conta"}
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-neon/80">your shadow, everywhere</p>

        {confirmMessage && (
          <div className="mt-4 flex w-full items-center gap-2 rounded-md border border-neon/40 bg-neon/10 px-4 py-3 text-xs text-neon">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{confirmMessage}</span>
          </div>
        )}

        {signupMessage && (
          <div className="mt-4 flex w-full items-start gap-3 rounded-md border border-neon/40 bg-neon/10 px-4 py-4 text-xs whitespace-pre-line text-neon">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{signupMessage}</span>
          </div>
        )}

        {securityNotice && (
          <div role="status" className="mt-4 flex w-full items-start gap-3 rounded-md border border-amber-400/40 bg-amber-400/5 px-4 py-3 text-xs text-amber-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{securityNotice} Tente novamente se a operação não concluir.</span>
          </div>
        )}

        <div className="mt-7 w-full terminal-card scanlines relative overflow-hidden">
          {/* Alternância clara entre entrar e criar conta */}
          <div className="grid grid-cols-2 border-b border-border/60">
            {(["in", "up"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                  mode === m
                    ? "bg-neon/10 text-neon"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "in" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-5 p-6">
            <div>
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                E-mail
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={verifyEmailFree}
                required
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                placeholder="voce@email.com"
                className={emailTaken ? "border-amber-400/60" : undefined}
              />
              {mode === "up" && checkingEmail && (
                <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">verificando e-mail…</p>
              )}
              {mode === "up" && emailTaken && !checkingEmail && (
                <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-amber-400">
                  Já existe conta com esse e-mail. O Gmail ignora pontos e “+tag”, então
                  variações contam como a mesma caixa.{" "}
                  <button type="button" onClick={() => setMode("in")} className="underline hover:text-neon">
                    Entrar
                  </button>
                </p>
              )}
            </div>


            <div>
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Senha
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "in" ? "current-password" : "new-password"}
                  placeholder={mode === "up" ? "mínimo 6 caracteres" : "••••••••"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-neon"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full font-mono uppercase tracking-wider"
              disabled={loading || (mode === "up" && signupBlockSecs > 0)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "up" && signupBlockSecs > 0
                ? `Aguarde ${signupBlockSecs}s`
                : mode === "in" ? "Entrar" : "Criar conta"}
            </Button>

            {mode === "up" && signupBlockSecs > 0 && (
              <p className="font-mono text-[10px] leading-relaxed text-amber-400">
                Muitas tentativas de cadastro nesta conexão. O bloqueio é temporário —
                se você é cliente de verdade, fale com o suporte que liberamos na hora.
              </p>
            )}


            <p className="flex items-start gap-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon/70" />
              {mode === "up"
                ? "Acesso imediato ao painel. A confirmação do e-mail pode ser feita depois, lá dentro."
                : "Conexão criptografada. Nunca pedimos sua senha por chat ou e-mail."}
            </p>
          </form>
        </div>

        {(emailBlocked || signupMessage) && (
          <div className="mt-4 w-full rounded-md border border-amber-400/40 bg-amber-400/5 p-4 text-xs">
            <p className="font-mono uppercase tracking-wider text-amber-400">Não recebeu o e-mail?</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>1. Verifique as pastas <strong>Spam</strong> e <strong>Promoções</strong>.</li>
              <li>2. Confira se digitou o e-mail corretamente.</li>
              <li>3. Reenvie apenas uma vez — reenvios seguidos bloqueiam o envio.</li>
            </ul>

            {sendInfo.count > 0 && (
              <div className="mt-3 rounded border border-neon/40 bg-neon/5 px-3 py-2">
                <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-neon">
                  <Mail className="h-3 w-3" /> E-mail enviado
                  {sendInfo.last ? ` às ${formatTime(sendInfo.last)}` : ""}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {sendInfo.count} {sendInfo.count === 1 ? "envio" : "envios"} na última hora
                  {" · "}restam {Math.max(0, MAX_ATTEMPTS_PER_HOUR - sendInfo.count)} de {MAX_ATTEMPTS_PER_HOUR}
                </p>
              </div>
            )}

            {cooldown > 0 && (
              <p className="mt-3 font-mono text-[10px] text-amber-400">
                Aguarde {cooldown}s antes de reenviar — o e-mail anterior ainda pode chegar.
              </p>
            )}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full font-mono text-[11px] uppercase"
                disabled={resending || cooldown > 0}
                onClick={resendConfirmation}
              >
                {resending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar confirmação"}
              </Button>
              <Button asChild variant="ghost" className="w-full font-mono text-[11px] uppercase">
                <Link to="/contato">
                  <LifeBuoy className="mr-2 h-3 w-3" /> Ativar via suporte
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Ajuda fica recolhida para manter o fluxo principal limpo */}
        <details className="mt-6 w-full rounded-md border border-border/60 bg-card/40">
          <summary className="cursor-pointer list-none px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-neon">
            Problemas para entrar?
          </summary>
          <div className="space-y-3 border-t border-border/60 p-4">
            <Link
              to="/recuperar"
              className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-neon"
            >
              Perdi o acesso ao meu e-mail → recuperar conta
            </Link>
            <Link
              to="/contato"
              className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-neon"
            >
              Falar com o suporte
            </Link>
            <Lost2faHelp className="w-full" />
          </div>
        </details>

        <Link to="/" className="mt-5 text-xs text-muted-foreground hover:text-foreground">← Voltar ao início</Link>
      </main>
    </div>
  );
}
