import { useCallback, useEffect, useRef, useState } from "react";
import { MailWarning, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { siteUrl } from "@/lib/site-url";

/**
 * Cadastro não exige confirmação de e-mail: o cliente entra na hora.
 * Este aviso aparece só enquanto o e-mail não foi confirmado e tenta
 * reenviar sozinho quando o envio volta a funcionar (com limite de tentativas).
 */

const MAX_AUTO_ATTEMPTS = 3;
const RETRY_INTERVAL_MS = 10 * 60 * 1000; // 10 min entre tentativas automáticas
const BACKOFF_MS = 90 * 1000; // espera após falha (limite de envio, etc.)

type AutoState = { attempts: number; lastAt: number; done: boolean };

const keyFor = (email: string) => `sd_confirm_auto_${email.trim().toLowerCase()}`;

function readAuto(email: string): AutoState {
  try {
    const raw = localStorage.getItem(keyFor(email));
    if (!raw) return { attempts: 0, lastAt: 0, done: false };
    const parsed = JSON.parse(raw);
    return {
      attempts: Number(parsed.attempts) || 0,
      lastAt: Number(parsed.lastAt) || 0,
      done: Boolean(parsed.done),
    };
  } catch {
    return { attempts: 0, lastAt: 0, done: false };
  }
}

function writeAuto(email: string, state: AutoState) {
  try {
    localStorage.setItem(keyFor(email), JSON.stringify(state));
  } catch {
    /* storage indisponível: segue sem persistir */
  }
}

export function EmailConfirmBanner() {
  const [email, setEmail] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(true);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [auto, setAuto] = useState<AutoState>({ attempts: 0, lastAt: 0, done: false });
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const user = data.user;
      if (!user) return;
      setEmail(user.email ?? null);
      setConfirmed(Boolean((user as any).email_confirmed_at ?? (user as any).confirmed_at));
      if (user.email) setAuto(readAuto(user.email));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = useCallback(
    async (mode: "auto" | "manual") => {
      if (!email || busy.current) return;
      busy.current = true;
      if (mode === "manual") setSending(true);
      try {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: siteUrl() },
        });
        if (error) throw error;

        const next: AutoState = {
          attempts: mode === "auto" ? auto.attempts + 1 : auto.attempts,
          lastAt: Date.now(),
          done: mode === "auto" ? auto.attempts + 1 >= MAX_AUTO_ATTEMPTS : auto.done,
        };
        setAuto(next);
        writeAuto(email, next);
        setCooldown(60);
        setAutoStatus(
          mode === "auto"
            ? `Reenvio automático feito (${next.attempts}/${MAX_AUTO_ATTEMPTS}). Confirme assim que o e-mail chegar.`
            : null,
        );
        if (mode === "manual") toast.success("E-mail de confirmação enviado. Confirme assim que chegar.");
      } catch (e: any) {
        const msg = e?.message ?? "Não foi possível enviar agora.";
        if (mode === "auto") {
          // Falha (limite de envio ou instabilidade): não gasta tentativa, tenta de novo depois.
          const next = { ...auto, lastAt: Date.now() - RETRY_INTERVAL_MS + BACKOFF_MS };
          setAuto(next);
          writeAuto(email, next);
          setAutoStatus("Envio instável no momento — vamos tentar reenviar sozinho em instantes.");
        } else {
          toast.error(msg);
          setCooldown(60);
        }
      } finally {
        busy.current = false;
        setSending(false);
      }
    },
    [auto, email],
  );

  // Reenvio automático: tenta quando o envio volta a funcionar, respeitando o limite.
  useEffect(() => {
    if (!email || confirmed) return;
    const tick = () => {
      if (busy.current || auto.done || auto.attempts >= MAX_AUTO_ATTEMPTS) return;
      if (Date.now() - auto.lastAt < RETRY_INTERVAL_MS) return;
      void send("auto");
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [auto, confirmed, email, send]);

  if (confirmed || !email) return null;

  const exhausted = auto.attempts >= MAX_AUTO_ATTEMPTS;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-sm">
            <p className="font-mono uppercase tracking-wider text-amber-300">Confirmação de e-mail pendente</p>
            <p className="text-muted-foreground">
              Sua conta já está liberada e você pode usar o painel normalmente. Enviamos um e-mail
              de confirmação para <strong className="text-amber-200">{email}</strong>. Ele pode
              levar alguns minutos para chegar.
            </p>
            <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
              <li>Verifique a caixa de entrada, spam e promoções.</li>
              <li>Clique no link do e-mail para proteger sua conta e habilitar a recuperação de senha.</li>
              <li>Se não receber, clicamos no botão ao lado para enviar novamente.</li>
            </ul>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-200/80">
              <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {autoStatus ??
                  (exhausted
                    ? `Reenvio automático concluído (${MAX_AUTO_ATTEMPTS}/${MAX_AUTO_ATTEMPTS}). Se ainda não recebeu, clique em "Enviar confirmação".`
                    : `Reenvio automático ativo: tentamos enviar sozinho quando o serviço volta (${auto.attempts}/${MAX_AUTO_ATTEMPTS} tentativas).`)}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => send("manual")}
          disabled={sending || cooldown > 0}
          className="shrink-0 font-mono uppercase tracking-wider"
        >
          {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Enviar confirmação"}
        </Button>
      </div>
    </div>
  );
}
