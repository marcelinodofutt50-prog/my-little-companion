import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, RefreshCw, Loader2, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToolbarGroup, toolbarItem } from "@/components/support/chat-toolbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { adminReplaceUserTrial, adminCreateLicenseForClient } from "@/lib/admin.functions";

/**
 * Ações de licença direto na conversa de suporte selecionada.
 * NÃO provisiona nada por conta própria: apenas chama as funções de admin que já
 * existem e são testadas (adminReplaceUserTrial / adminCreateLicenseForClient).
 * A emissão posta as credenciais na própria conversa (postToThreadId), então o
 * cliente recebe o acesso ali mesmo.
 */

const PLANS = [
  { slug: "login-7d", label: "Semanal", hint: "7 dias" },
  { slug: "login-30d", label: "Mensal", hint: "30 dias" },
  { slug: "login-lifetime", label: "Vitalício", hint: "permanente" },
] as const;

export function SupportLicenseActions({
  userId,
  email,
  threadId,
  onDone,
}: {
  userId: string;
  email?: string | null;
  threadId: string;
  onDone?: () => void;
}) {
  const replaceTrial = useServerFn(adminReplaceUserTrial);
  const createLicense = useServerFn(adminCreateLicenseForClient);

  const [trialBusy, setTrialBusy] = useState(false);
  const [licOpen, setLicOpen] = useState(false);
  const [plan, setPlan] = useState<string>("login-30d");
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const [licBusy, setLicBusy] = useState(false);

  const doRecreateTrial = async () => {
    setTrialBusy(true);
    try {
      await replaceTrial({ data: { userId } });
      toast.success("Trial recriada — o cliente vê as novas credenciais no painel dele.");
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível recriar a trial.");
    } finally {
      setTrialBusy(false);
    }
  };

  const doAddLicense = async () => {
    if (!email) {
      toast.error("Cliente sem e-mail no cadastro — não dá para emitir por aqui.");
      return;
    }
    if (!receiptConfirmed) return;
    setLicBusy(true);
    try {
      await createLicense({
        data: { userEmail: email, planSlug: plan as any, postToThreadId: threadId },
      });
      toast.success("Licença emitida — credenciais enviadas na conversa.");
      setLicOpen(false);
      setReceiptConfirmed(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível emitir a licença.");
    } finally {
      setLicBusy(false);
    }
  };

  return (
    <ToolbarGroup label="Licença e acesso">
      {/* Recriar trial — confirmação, porque apaga a conta de teste antiga no painel */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className={toolbarItem}
            title="Apaga a trial atual no painel e provisiona uma nova"
            disabled={trialBusy}
          >
            {trialBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Recriar trial
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recriar a trial deste cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove a conta de teste atual no painel e gera uma nova trial, com credenciais novas, para{" "}
              <strong>{email ?? "este cliente"}</strong>. Use quando a trial travou, expirou ou deu erro de login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doRecreateTrial();
              }}
            >
              Recriar trial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adicionar licença — com lembrete do comprovante como trava */}
      <Dialog
        open={licOpen}
        onOpenChange={(o) => {
          setLicOpen(o);
          if (!o) setReceiptConfirmed(false);
        }}
      >
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className={toolbarItem}
            title="Emitir uma licença paga para este cliente"
          >
            <Plus className="h-3 w-3" /> Adicionar licença
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar licença</DialogTitle>
            <DialogDescription>
              Emite uma licença paga para <strong>{email ?? "este cliente"}</strong> e envia as credenciais aqui
              na conversa.
            </DialogDescription>
          </DialogHeader>

          {/* Lembrete do comprovante — trava a emissão até confirmar (pra não esquecer) */}
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-500">
              <AlertTriangle className="h-4 w-4" /> O cliente acabou de pagar?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Registre o comprovante na aba <strong>Comprovantes</strong> antes de liberar. Marque abaixo para
              confirmar — a emissão só libera depois disso.
            </p>
            <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-xs text-foreground">
              <Checkbox
                checked={receiptConfirmed}
                onCheckedChange={(v) => setReceiptConfirmed(!!v)}
                className="mt-0.5"
              />
              <span>Confirmo que registrei o comprovante (ou é liberação sem pagamento).</span>
            </label>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Plano</Label>
            <RadioGroup value={plan} onValueChange={setPlan} className="mt-2 grid gap-2">
              {PLANS.map((p) => (
                <label
                  key={p.slug}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                    plan === p.slug ? "border-primary bg-primary/5" : "border-border hover:border-border/80",
                  )}
                >
                  <RadioGroupItem value={p.slug} />
                  <span className="font-semibold text-foreground">{p.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{p.hint}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLicOpen(false)} disabled={licBusy}>
              Cancelar
            </Button>
            <Button onClick={() => void doAddLicense()} disabled={!receiptConfirmed || licBusy}>
              {licBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Emitir licença
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ToolbarGroup>
  );
}
