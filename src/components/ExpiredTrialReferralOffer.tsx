import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift, Users, X, ArrowRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  userId: string;
  referralCode?: string | null;
};

/**
 * Re-engagement campaign shown only after a trial license has expired.
 * Dismissal is scoped to the signed-in account in localStorage.
 */
export function ExpiredTrialReferralOffer({ userId, referralCode }: Props) {
  const [step, setStep] = useState<"offer" | "invite" | "hidden">("hidden");
  const [copied, setCopied] = useState(false);
  const storageKey = `shadow:expired-trial-referral-offer:v1:${userId}`;

  useEffect(() => {
    try {
      setStep(localStorage.getItem(storageKey) === "dismissed" ? "hidden" : "offer");
    } catch {
      setStep("offer");
    }
  }, [storageKey]);

  const dismiss = () => {
    try { localStorage.setItem(storageKey, "dismissed"); } catch {}
    setStep("hidden");
  };

  const inviteUrl = referralCode
    ? `https://www.shadowdashstore.com/auth?ref=${encodeURIComponent(referralCode)}`
    : null;

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Link de indicação copiado!");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Abra seu painel de indicações para copiar o link.");
    }
  };

  if (step === "hidden") return null;

  return (
    <section
      role="region"
      aria-labelledby="expired-trial-referral-title"
      className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-[0_18px_55px_-35px_var(--primary)] md:p-6"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <button
        type="button"
        aria-label="Fechar oferta"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-background/70 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      {step === "offer" ? (
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Gift className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1 pr-5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Oferta especial para você</p>
            <h2 id="expired-trial-referral-title" className="mt-1 text-xl font-bold text-foreground md:text-2xl">
              Seu teste acabou. Que tal ganhar 7 dias grátis?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Convide um amigo para conhecer a Shadow e confira como participar da campanha de indicação.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setStep("invite")} className="gap-2">
                Sim, quero participar <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={dismiss}>Agora não</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Campanha de indicação</span>
          </div>
          <h2 id="expired-trial-referral-title" className="text-xl font-bold text-foreground md:text-2xl">
            Convide um amigo para a Shadow
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Compartilhe seu link pessoal. Acesse o painel de indicações para acompanhar seus convites e as regras de recompensa disponíveis na sua conta.
          </p>
          {inviteUrl && (
            <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/60 p-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all text-xs text-primary">{inviteUrl}</code>
              <Button variant="outline" size="sm" onClick={() => void copyInvite()} className="shrink-0 gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar link"}
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2">
              <Link to="/indicacoes">Abrir painel de indicações <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" onClick={dismiss}>Fechar</Button>
          </div>
        </div>
      )}
    </section>
  );
}
