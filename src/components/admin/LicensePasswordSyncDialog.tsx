import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminSetLicensePassword, adminSyncLicensePasswordFromPanel } from "@/lib/admin.functions";

type Lic = {
  id: string;
  yaarsa_email?: string | null;
  password_synced_at?: string | null;
  password_sync_status?: string | null;
  password_sync_error?: string | null;
} | null;

const STATUS_LABEL: Record<string, string> = {
  ok: "Sincronizado — a senha daqui é a mesma do painel",
  adopted: "Senha do painel adotada",
  applied: "Senha aplicada no painel e salva aqui",
  manual: "Registrada manualmente (você trocou no painel)",
  divergent: "Divergente — o painel tem outra senha",
  unknown: "O painel não devolveu a senha",
  error: "Erro na última sincronização",
};

const isBad = (s?: string | null) => s === "divergent" || s === "unknown" || s === "error";

/**
 * Fluxo de senha do login: primeiro confere no painel Yaarsa (com status da
 * última sincronização), depois atualiza a senha que o cliente vê.
 */
export function LicensePasswordSyncDialog({
  license,
  open,
  onOpenChange,
  onDone,
}: {
  license: Lic;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void | Promise<void>;
}) {
  const syncFn = useServerFn(adminSyncLicensePasswordFromPanel);
  const saveFn = useServerFn(adminSetLicensePassword);

  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [applyToPanel, setApplyToPanel] = useState(false);

  useEffect(() => {
    if (open) {
      setResult(null);
      setPassword("");
      setApplyToPanel(false);
    }
  }, [open, license?.id]);

  if (!license) return null;

  const status = result?.status ?? license.password_sync_status ?? null;
  const syncedAt = result ? new Date().toISOString() : (license.password_synced_at ?? null);
  const errorText = result ? (isBad(result.status) ? result.message : null) : license.password_sync_error;

  const check = async (adopt: boolean) => {
    setChecking(true);
    try {
      const r: any = await syncFn({ data: { licenseId: license.id, adopt } });
      setResult(r);
      if (r.panelPassword && !adopt) setPassword(r.panelPassword);
      (r.ok ? toast.success : toast.warning)(r.message);
      await onDone();
    } catch (e: any) {
      setResult({ status: "error", message: e?.message ?? "Falha na sincronização." });
      toast.error(e?.message ?? "Falha na sincronização.");
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    if (password.trim().length < 4) {
      toast.error("A senha precisa ter pelo menos 4 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const r: any = await saveFn({
        data: { licenseId: license.id, newPassword: password.trim(), applyToPanel },
      });
      toast.success(
        r.appliedToPanel
          ? "Senha aplicada no painel e atualizada para o cliente."
          : "Senha atualizada no painel do cliente (aba Licenças).",
        { duration: 8000 },
      );
      await onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar a senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Senha do login
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            {license.yaarsa_email ?? "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="flex items-start gap-2">
              {isBad(status) ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="font-mono text-[11px]">
                  {status ? (STATUS_LABEL[status] ?? status) : "Nunca sincronizado com o painel"}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  última sincronização:{" "}
                  {syncedAt ? new Date(syncedAt).toLocaleString("pt-BR") : "nunca"}
                </p>
                {errorText && (
                  <p className="font-mono text-[10px] text-amber-400">{errorText}</p>
                )}
                {result?.panelPassword && (
                  <p className="font-mono text-[10px] text-cyan">
                    senha no painel: {result.panelPassword}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={checking} onClick={() => void check(false)}>
                {checking ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Conferir no painel
              </Button>
              {result?.status === "divergent" && (
                <Button size="sm" disabled={checking} onClick={() => void check(true)}>
                  Adotar a senha do painel
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase text-muted-foreground">
              Nova senha do cliente
            </label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="a senha que você definiu no painel"
              className="font-mono"
            />
            <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
              <input
                type="checkbox"
                checked={applyToPanel}
                onChange={(e) => setApplyToPanel(e.target.checked)}
              />
              Aplicar esta senha TAMBÉM no painel Yaarsa
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Atualizar para o cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
