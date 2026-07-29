import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import shadowMark from "@/assets/shadow-mask.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { siteUrl } from "@/lib/site-url";
import { Lost2faHelp } from "@/components/Lost2faHelp";


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

function AuthPage() {
  const { next, code, type } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Contagem regressiva quando o envio de e-mails está temporariamente bloqueado.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || cooldown > 0) return;
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: siteUrl() },
        });
        if (error) throw error;
        toast.success("Conta criada! Confirme seu e-mail.");
        setSignupMessage(
          "Enviamos um e-mail de confirmação para você.\n\n" +
          "1. Abra o Gmail (ou app de e-mail).\n" +
          "2. Procure por uma mensagem da Shadow.\n" +
          "3. Clique no botão laranja \"Confirmar e-mail\".\n" +
          "4. Você será logado automaticamente.\n\n" +
          "Se não achar, olhe na pasta Spam ou Promoções."
        );
        setCooldown(60);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: (next as any) || "/dashboard" });
      }
    } catch (err: any) {
      const raw = String(err?.message ?? "");
      const status = err?.status ?? err?.code;
      const isRateLimit =
        status === 429 ||
        /rate limit|too many requests|over_email_send_rate_limit|security purposes/i.test(raw);

      if (isRateLimit) {
        const secs = Number(raw.match(/(\d+)\s*second/i)?.[1] ?? 60);
        setCooldown(secs);
        setSignupMessage(null);
        toast.error(
          `Muitas tentativas de envio de e-mail agora. Aguarde ${secs}s e tente de novo — sua conta não foi perdida.`
        );
      } else if (/already registered|already been registered|user already/i.test(raw)) {
        toast.error("Este e-mail já tem conta. Use \"Entrar\" ou recupere o acesso.");
        setMode("in");
      } else if (/email not confirmed/i.test(raw)) {
        toast.error("Confirme seu e-mail antes de entrar. Veja a caixa de entrada e o spam.");
      } else if (/invalid login credentials/i.test(raw)) {
        toast.error("E-mail ou senha incorretos.");
      } else {
        toast.error(raw || "Não foi possível concluir. Tente novamente.");
      }
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
