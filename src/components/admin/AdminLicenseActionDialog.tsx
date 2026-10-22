import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export type LicenseAction = "revoke" | "extend" | "renew" | "recreate";
export type LicenseActionTarget = {
  action: LicenseAction;
  license: { id: string; yaarsa_username?: string | null; expires_at?: string | null; profile?: { email?: string | null } | null };
};

const content: Record<LicenseAction, { title: string; description: string; confirm: string }> = {
  revoke: { title: "Revogar licença", description: "O acesso deste cliente será bloqueado. Esta ação não é uma pausa e não congela os dias restantes.", confirm: "Revogar acesso" },
  extend: { title: "Alterar validade", description: "Confira a nova data antes de alterar a validade desta licença.", confirm: "Salvar validade" },
  renew: { title: "Renovar servidor", description: "A mensalidade do servidor será renovada até o próximo dia 20, conforme a regra atual.", confirm: "Renovar servidor" },
  recreate: { title: "Recriar credenciais", description: "A senha anterior será substituída. Após concluir, confira a nova senha no botão de senha da licença.", confirm: "Recriar credenciais" },
};

export function AdminLicenseActionDialog({ target, busy, onClose, onConfirm }: {
  target: LicenseActionTarget | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (date: string) => void;
}) {
  const [date, setDate] = useState("");
  useEffect(() => { setDate(target?.license.expires_at?.slice(0, 10) ?? ""); }, [target]);
  if (!target) return null;
  const copy = content[target.action];
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <AlertDialogContent className="border-border bg-background">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="grid min-w-0 gap-2 text-sm" data-sensitive>
          <div><dt className="text-muted-foreground">Cliente</dt><dd className="break-all">{target.license.profile?.email ?? "Sem e-mail disponível"}</dd></div>
          <div><dt className="text-muted-foreground">Login</dt><dd className="break-all font-mono">{target.license.yaarsa_username ?? "—"}</dd></div>
        </dl>
        {target.action === "extend" && <div className="space-y-2">
          <label htmlFor="admin-license-expiry" className="text-sm">Nova validade</label>
          <Input id="admin-license-expiry" type="date" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} />
        </div>}
        <AlertDialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button variant={target.action === "revoke" ? "destructive" : "default"} disabled={busy || (target.action === "extend" && !date)} onClick={() => onConfirm(date)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? "Processando…" : copy.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}