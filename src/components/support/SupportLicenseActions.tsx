import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  KeyRound,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Plus,
  Wrench,
  ChevronDown,
  Stethoscope,
  Upload,
  FileCheck2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToolbarGroup, toolbarItem } from "@/components/support/chat-toolbar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { adminReplaceUserTrial, adminCreateLicenseForClient, adminHealUserLogins } from "@/lib/admin.functions";
import { adminAttachReceiptForUser } from "@/lib/purchase-evidence.functions";

/**
 * "Funções de mod" na conversa de suporte selecionada: um botão só, que abre um
 * menu com as ações de licença/acesso, pra não lotar o header.
 * NÃO provisiona nada por conta própria — só chama funções de admin já existentes
 * e testadas (adminReplaceUserTrial / adminCreateLicenseForClient /
 * adminHealUserLogins / adminAttachReceiptForUser).
 */

const PLANS = [
  { slug: "login-7d", label: "Semanal", hint: "7 dias" },
  { slug: "login-30d", label: "Mensal", hint: "30 dias" },
  { slug: "login-lifetime", label: "Vitalício", hint: "permanente" },
] as const;

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

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
  const healLogins = useServerFn(adminHealUserLogins);
  const attachReceipt = useServerFn(adminAttachReceiptForUser);

  const [trialOpen, setTrialOpen] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [healBusy, setHealBusy] = useState(false);
  const [licOpen, setLicOpen] = useState(false);
  const [plan, setPlan] = useState<string>("login-30d");
  const [file, setFile] = useState<File | null>(null);
  const [courtesy, setCourtesy] = useState(false);
  const [licBusy, setLicBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetLicense = () => {
    setFile(null);
    setCourtesy(false);
    setPlan("login-30d");
    if (fileRef.current) fileRef.current.value = "";
  };

  const doRecreateTrial = async () => {
    setTrialBusy(true);
    try {
      await replaceTrial({ data: { userId } });
      toast.success("Trial recriada — o cliente vê as novas credenciais no painel dele.");
      setTrialOpen(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível recriar a trial.");
    } finally {
      setTrialBusy(false);
    }
  };

  const doHeal = async () => {
    setHealBusy(true);
    try {
      const res: any = await healLogins({ data: { userId } });
      const healed = res?.healed ?? [];
      const failed = healed.filter((h: any) => h.action === "failed");
      if (healed.length === 0) {
        toast.info("Nenhuma licença ativa para reparar neste cliente.");
      } else if (failed.length === healed.length) {
        toast.error("Não foi possível reparar o acesso. Tente de novo em instantes.");
      } else {
        toast.success("Acesso reparado — senha reaplicada no painel.");
      }
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reparar o acesso.");
    } finally {
      setHealBusy(false);
    }
  };

  const onPickFile = (f: File | null) => {
    if (f && f.size > MAX_RECEIPT_BYTES) {
      toast.error("Arquivo acima de 5 MB. Envie um menor.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFile(f);
    if (f) setCourtesy(false);
  };

  const canEmit = (!!file || courtesy) && !licBusy;

  const doAddLicense = async () => {
    if (!email) {
      toast.error("Cliente sem e-mail no cadastro — não dá para emitir por aqui.");
      return;
    }
    if (!file && !courtesy) return;
    setLicBusy(true);
    try {
      // 1) Anexa o comprovante primeiro (se houver). Assim não dá pra esquecer.
      if (file) {
        const base64 = await fileToBase64(file);
        await attachReceipt({ data: { userId, filename: file.name, base64, payerName: email ?? undefined } });
      }
      // 2) Emite a licença e posta as credenciais na conversa.
      await createLicense({
        data: { userEmail: email, planSlug: plan as any, postToThreadId: threadId },
      });
      toast.success(
        file ? "Comprovante anexado e licença emitida na conversa." : "Licença emitida — credenciais enviadas na conversa.",
      );
      setLicOpen(false);
      resetLicense();
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível emitir a licença.");
    } finally {
      setLicBusy(false);
    }
  };

  return (
    <>
      <ToolbarGroup label="Funções de mod">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className={toolbarItem} title="Ações de licença e acesso" disabled={healBusy}>
              {healBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
              Funções de mod
              <ChevronDown className="h-3 w-3 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Licença e acesso</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                // deixa o menu fechar antes de abrir o diálogo (evita o
                // diálogo fechar na hora por corrida de foco do Radix)
                setTimeout(() => setLicOpen(true), 0);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Adicionar licença
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void doHeal()}>
              <Stethoscope className="mr-2 h-4 w-4" /> Reparar acesso
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-amber-500 focus:text-amber-500"
              onSelect={() => {
                setTimeout(() => setTrialOpen(true), 0);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Recriar trial
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ToolbarGroup>

      {/* Recriar trial — confirmação, porque apaga a conta de teste antiga no painel */}
      <AlertDialog open={trialOpen} onOpenChange={setTrialOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recriar a trial deste cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove a conta de teste atual no painel e gera uma nova trial, com credenciais novas, para{" "}
              <strong>{email ?? "este cliente"}</strong>. Use quando a trial travou, expirou ou deu erro de login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={trialBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={trialBusy}
              onClick={(e) => {
                e.preventDefault();
                void doRecreateTrial();
              }}
            >
              {trialBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Recriar trial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adicionar licença — com anexo do comprovante na hora */}
      <Dialog
        open={licOpen}
        onOpenChange={(o) => {
          setLicOpen(o);
          if (!o) resetLicense();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar licença</DialogTitle>
            <DialogDescription>
              Emite uma licença paga para <strong>{email ?? "este cliente"}</strong> e envia as credenciais aqui
              na conversa.
            </DialogDescription>
          </DialogHeader>

          {/* Comprovante — anexo na hora, pra não esquecer */}
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-500">
              <AlertTriangle className="h-4 w-4" /> O cliente acabou de pagar?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Anexe o comprovante agora — fica salvo na aba <strong>Comprovantes</strong>, vinculado a este cliente.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />

            {file ? (
              <div className="mt-2.5 flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs">
                <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
                <button
                  type="button"
                  onClick={() => onPickFile(null)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Remover comprovante"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2.5 w-full border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                onClick={() => fileRef.current?.click()}
                disabled={courtesy}
              >
                <Upload className="h-4 w-4" /> Anexar comprovante (PNG, JPG ou PDF)
              </Button>
            )}

            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={courtesy}
                onCheckedChange={(v) => {
                  const on = !!v;
                  setCourtesy(on);
                  if (on) onPickFile(null);
                }}
              />
              <span>É liberação sem pagamento (cortesia / sem comprovante).</span>
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
            <Button onClick={() => void doAddLicense()} disabled={!canEmit}>
              {licBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Emitir licença
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
