import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, KeyRound, LifeBuoy, Loader2, RadioTower, RefreshCw, Server, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { isPasswordValid, passwordError, passwordRules } from "@/lib/password-policy";
import { friendlyPanelError } from "@/lib/panel-errors";

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
    if (repairing) return;
    setRepairing(true);
    const t = toast.loading("Reparando seu acesso no painel… pode levar até 1 minuto.");
    try {
      const res: any = await repairAccess({ data: { licenseId } });
      const steps: string[] = Array.isArray(res?.steps) ? res.steps : [];
      toast.success(res?.message ?? "Acesso ressincronizado.", {
        id: t,
        description: steps.length ? steps.slice(-3).join(" • ") : undefined,
        duration: 8000,
      });
      onDone?.();
    } catch (e: any) {
      const msg = friendlyPanelError(e, "Falha ao reparar o acesso.");
      const busy = /andamento/i.test(msg);
      toast.error(busy ? "Já estamos reparando este login" : "Não deu para reparar agora", {
        id: t,
        description: busy
          ? "Aguarde alguns segundos e teste o login antes de clicar de novo."
          : `${msg} Se continuar, abra um chamado no suporte.`,
        duration: 9000,
      });
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
      else if (res?.confirmed) toast.success(res.message, { id: t });
      else if (res?.missing) toast.error(res.message, { id: t, duration: 8000 });
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
      <div data-repair-callout className="mb-3 flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wrench className="h-4 w-4 shrink-0 text-primary" /> Não consegue logar no BTmob?
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Senha recusada, login sumiu ou apareceu "network error" ao entrar? Clique em <strong className="text-foreground">Reparar acesso</strong> primeiro —
            ele confere e recria seu login no painel em segundos, sem precisar chamar o suporte.
          </p>
        </div>
        <Button
          size="sm"
          disabled={paused || repairing}
          onClick={runRepair}
          className="relative h-9 shrink-0 font-mono text-[10px] uppercase tracking-wider shadow-md"
        >
          {!repairing && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-primary" />}
          {repairing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wrench className="mr-1.5 h-3.5 w-3.5" />}
          {repairing ? "Reparando..." : "Reparar acesso"}
        </Button>
      </div>
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
        Pagou a taxa do servidor e a licença continua inativa? Use “Já paguei o servidor” para aplicar o próximo ciclo (dia 20).
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Trocar senha do painel</DialogTitle>
            <DialogDescription>
              A nova senha é aplicada direto no seu login do BTmob. Ela precisa ter maiúscula,
              minúscula, número e um caractere especial (@ # . _ -).
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
            <ul className="space-y-1">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className={`flex items-center gap-1.5 font-mono text-[10px] ${
                    r.ok ? "text-emerald-400" : "text-muted-foreground"
                  }`}
                >
                  {r.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {r.label}
                </li>
              ))}
            </ul>
            <Input
              type="text"
              autoComplete="off"
              placeholder="Repita a nova senha"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              className="font-mono"
            />
            {pwd2.length > 0 && pwd !== pwd2 && (
              <p className="font-mono text-[10px] text-amber-400">As senhas não são iguais.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submitPassword} disabled={saving || !pwdOk || pwd !== pwd2}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Salvar senha
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
}
