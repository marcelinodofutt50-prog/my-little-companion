import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift, Users, Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Oferta de marketing exibida quando o teste grátis acaba e o cliente não tem
 * nenhuma licença paga ativa. Passo 1: "Quer ganhar 7 dias grátis?" (Sim/Não).
 * Passo 2: "Indique um amigo" com o link de indicação.
 * Aparece uma vez por teste (lembrado no navegador).
 */
export function TrialEndedReferralOffer({
  trialId,
  referralCode,
}: {
  trialId: string | null;
  referralCode?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [copied, setCopied] = useState(false);
  const key = trialId ? `shadow:trial-offer:${trialId}` : null;

  useEffect(() => {
    if (!key) return;
    try {
      if (!localStorage.getItem(key)) setOpen(true);
    } catch {
      /* sem storage */
    }
  }, [key]);

  const close = () => {
    setOpen(false);
    if (key) try { localStorage.setItem(key, "1"); } catch { /* */ }
  };

  const link = typeof window !== "undefined" && referralCode
    ? `${window.location.origin}/auth?ref=${referralCode}`
    : null;

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="border-primary/40 sm:max-w-md">
        {step === 1 ? (
          <>
            <DialogHeader className="items-center text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                <Gift className="h-7 w-7" />
              </div>
              <DialogTitle className="text-xl">Seu teste grátis acabou</DialogTitle>
              <DialogDescription className="text-base">
                Quer ganhar uma licença de <span className="font-bold text-primary">7 dias totalmente grátis</span>?
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={close}>Não, obrigado</Button>
              <Button onClick={() => setStep(2)}>Sim, quero!</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="items-center text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                <Users className="h-7 w-7" />
              </div>
              <DialogTitle className="text-xl">Indique um amigo</DialogTitle>
              <DialogDescription>
                Envie seu link para um amigo. Quando ele comprar qualquer plano, você ganha um login de 7 dias de graça.
              </DialogDescription>
            </DialogHeader>
            {link && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
                <code className="flex-1 truncate font-mono text-xs">{link}</code>
                <Button size="sm" variant="outline" onClick={copy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
            <div className="grid gap-2">
              <Button asChild onClick={close}>
                <Link to="/indicacoes">Abrir minhas indicações</Link>
              </Button>
              <Button variant="ghost" asChild onClick={close}>
                <Link to="/planos">Prefiro ver os planos</Link>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
