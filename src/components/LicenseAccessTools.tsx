import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, KeyRound, LifeBuoy, Loader2, RadioTower, RefreshCw, Server, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { isPasswordValid, passwordError, passwordRules } from "@/lib/password-policy";

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
import {
  changeMyLicensePassword,
  repairMyLicenseAccess,
  resyncMyServerRenewal,
  syncMyLicensesWithPanel,
} from "@/lib/license.functions";


/**
 * Ações de autoatendimento da licença: trocar a senha do painel BTmob,
 * ressincronizar o acesso quando o login não funciona e reprocessar a
 * renovação do servidor já paga.
 */
export function LicenseAccessTools({
  licenseId,
  paused,
  onDone,
}: {
  licenseId: string;
  paused?: boolean;
  onDone?: () => void;
}) {
  const changePassword = useServerFn(changeMyLicensePassword);
  const repairAccess = useServerFn(repairMyLicenseAccess);
  const resyncRenewal = useServerFn(resyncMyServerRenewal);
  const syncPanel = useServerFn(syncMyLicensesWithPanel);

  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [saving, setSaving] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [panelSyncing, setPanelSyncing] = useState(false);


  const rules = passwordRules(pwd);
  const pwdOk = isPasswordValid(pwd);

  const submitPassword = async () => {
    if (!pwdOk) {
      toast.error(passwordError(pwd) ?? "Senha fora da política.");
      return;
    }
    if (pwd !== pwd2) {
      toast.error("As senhas não são iguais.");
      return;
    }
    setSaving(true);
    const t = toast.loading("Aplicando a nova senha no painel… isso pode levar alguns segundos.");
    try {
      const res: any = await changePassword({ data: { licenseId, newPassword: pwd.trim() } });
      toast.success(res?.message ?? "Senha atualizada.", { id: t });
      setOpen(false);
      setPwd("");
      setPwd2("");
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível trocar a senha agora.", { id: t });
    } finally {
      setSaving(false);
    }
  };


  const runRepair = async () => {
    setRepairing(true);
    try {
      const res: any = await repairAccess({ data: { licenseId } });
      toast.success(res?.message ?? "Acesso ressincronizado.");
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reparar o acesso.");
    } finally {
      setRepairing(false);
    }
  };

  const runResync = async () => {
    setResyncing(true);
    try {
      // Só este login é renovado — quem tem vários não perde a taxa paga em
      // outro acesso.
      const res: any = await resyncRenewal({ data: { licenseId } });
      if (res?.ok && res.fixed) toast.success(res.message);
      else toast.warning(res?.message ?? "Nenhum pagamento de servidor encontrado.");
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reprocessar a renovação.");
    } finally {
      setResyncing(false);
    }
  };

  // Lê a data real no painel Yaarsa: se lá já está liberado (pagamento manual
  // ou correção do suporte), o site reativa e ajusta a contagem de dias.
  const runPanelSync = async () => {
    setPanelSyncing(true);
    const t = toast.loading("Consultando o painel… a resposta do Yaarsa pode demorar alguns segundos.");
    try {
      const res: any = await syncPanel({ data: { licenseId } });
      if (res?.activated) toast.success(res.message, { id: t });
      else if (res?.unknown) {
        toast.warning(
          res?.message ?? "O painel não respondeu a tempo. Tente de novo em instantes.",
          { id: t },
        );
      } else toast.info(res?.message ?? "Nada para ajustar.", { id: t });
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao consultar o painel.", { id: t });
    } finally {
      setPanelSyncing(false);
    }
  };





  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link to="/renovar-servidor">
          <Button
            size="sm"
            variant="outline"
            className="rgb-border h-8 font-mono text-[9px] uppercase tracking-wider"
          >
            <Server className="mr-1.5 h-3.5 w-3.5 text-primary" />
            <span className="rgb-text animate-rgb-text">Renovar servidor</span>
          </Button>
        </Link>
        <Button
          size="sm"
          variant="outline"
          disabled={paused}
          onClick={() => setOpen(true)}
          className="h-8 font-mono text-[9px] uppercase tracking-wider"
        >
          <KeyRound className="mr-1.5 h-3.5 w-3.5 text-primary" />
          Trocar senha do painel
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={paused || repairing}
          onClick={runRepair}
          className="h-8 font-mono text-[9px] uppercase tracking-wider"
        >
          {repairing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Wrench className="mr-1.5 h-3.5 w-3.5 text-primary" />
          )}
          Reparar acesso
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={resyncing}
          onClick={runResync}
          className="h-8 font-mono text-[9px] uppercase tracking-wider"
        >
          {resyncing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-primary" />
          )}
          Já paguei o servidor
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={panelSyncing}
          onClick={runPanelSync}
          className="h-8 font-mono text-[9px] uppercase tracking-wider"
        >
          {panelSyncing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <RadioTower className="mr-1.5 h-3.5 w-3.5 text-primary" />
          )}
          Sincronizar com painel
        </Button>
      </div>

      <p className="mt-2 flex items-start gap-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
        <LifeBuoy className="mt-0.5 h-3 w-3 shrink-0" />
        Não consegue entrar no BTmob? Use “Reparar acesso”. Pagou a taxa do servidor e a licença
        continua inativa? Use “Já paguei o servidor” para aplicar o próximo ciclo (dia 20).
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Trocar senha do painel</DialogTitle>
            <DialogDescription>
              A nova senha é aplicada direto no seu login do BTmob. Use de 6 a 32 caracteres
              (letras, números e @ # . _ -).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="text"
              autoComplete="off"
              placeholder="Nova senha"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="font-mono"
            />
            <Input
              type="text"
              autoComplete="off"
              placeholder="Repita a nova senha"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submitPassword} disabled={saving || pwd.trim().length < 6}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Salvar senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
