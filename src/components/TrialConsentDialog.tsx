import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { acceptTrialTerms } from "@/lib/ban.functions";
import { getDeviceSignature } from "@/lib/device-signature";

const WAIT_SECONDS = 8;

export function TrialConsentDialog({
  open,
  onOpenChange,
  onAccepted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAccepted: (consentId: string) => void;
}) {
  const accept = useServerFn(acceptTrialTerms);
  const [checked, setChecked] = useState(false);
  const [left, setLeft] = useState(WAIT_SECONDS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChecked(false);
    setLeft(WAIT_SECONDS);
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [open]);

  async function confirm() {
    setBusy(true);
    try {
      const { consentId } = await accept({ data: getDeviceSignature() });
      onOpenChange(false);
      onAccepted(consentId);
    } catch (e: any) {
      toast.error("Não foi possível continuar", { description: String(e?.message ?? e).replace(/^Error:\s*/, "") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm uppercase">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Aviso importante sobre o teste
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Por conta das atitudes de alguns membros, que estavam <strong className="text-foreground">criando muitas contas</strong> para
                resgatar o teste várias vezes e abusaram da boa vontade da nossa equipe, o teste grátis foi reduzido para{" "}
                <strong className="text-foreground">3 horas e 30 minutos</strong>.
              </p>
              <p>
                Essas atitudes também violaram as regras e políticas do site: o teste é{" "}
                <strong className="text-foreground">exclusivamente para uso pessoal</strong>. É proibido colocar clientes ou "penas" no
                acesso de teste, revender acesso ou criar contas extras.
              </p>
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                Quem criar várias contas será banido automaticamente — o banimento vale também para todas as contas futuras.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
          <span>Li o aviso, entendi que o teste é só para uso pessoal e concordo com as regras.</span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void confirm()} disabled={!checked || left > 0 || busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {left > 0 ? `Aguarde ${left}s` : "Li e concordo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
