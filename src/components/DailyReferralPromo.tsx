import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift, Percent, CalendarDays, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Anúncio de indicação: aparece no máximo 1 vez por dia (horário de Brasília) para membros comuns. */
export function DailyReferralPromo({ referralCode, enabled }: { referralCode: string | null; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const key = "shadow:daily-referral-promo";
    try {
      if (localStorage.getItem(key) === day) return;
      const t = setTimeout(() => { setOpen(true); localStorage.setItem(key, day); }, 2500);
      return () => clearTimeout(t);
    } catch { /* */ }
  }, [enabled]);

  const link = typeof window !== "undefined" && referralCode ? `${window.location.origin}/auth?ref=${referralCode}` : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md border-primary/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary"><Gift className="h-5 w-5" /> Oferta do dia: indique e ganhe</DialogTitle>
          <DialogDescription>Convide um amigo pelo seu link. Quando ele comprar qualquer plano, você escolhe seu prêmio:</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-center">
            <Percent className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="text-lg font-bold">50% OFF</p>
            <p className="text-xs text-muted-foreground">no plano Vitalício</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <CalendarDays className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="text-lg font-bold">7 dias grátis</p>
            <p className="text-xs text-muted-foreground">de licença BTmob</p>
          </div>
        </div>
        {link ? (
          <div className="flex gap-2">
            <input readOnly value={link} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs" />
            <Button size="sm" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado!"); }}><Copy className="mr-1 h-3.5 w-3.5" />Copiar</Button>
          </div>
        ) : null}
        <p className="text-[11px] text-muted-foreground">O prêmio é liberado pela equipe depois que a compra do indicado é confirmada. Abra um chamado no suporte para resgatar.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Agora não</Button>
          <Button asChild><Link to="/fidelidade" onClick={() => setOpen(false)}>Ver minhas indicações</Link></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
