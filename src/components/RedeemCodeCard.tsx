import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { previewRedeemCode, redeemMyCode } from "@/lib/redeem-codes.functions";
import { planLabel } from "@/lib/license-display";

/**
 * Resgate de código de cortesia da equipe.
 * Códigos de servidor exigem escolher QUAL login será adiantado para o
 * próximo dia 20 — quem tem vários acessos não perde o benefício no errado.
 */
export function RedeemCodeCard({
  licenses,
  onDone,
}: {
  licenses?: any[];
  onDone?: () => void;
}) {
  const preview = useServerFn(previewRedeemCode);
  const redeem = useServerFn(redeemMyCode);

  const [code, setCode] = useState("");
  const [info, setInfo] = useState<any>(null);
  const [licenseId, setLicenseId] = useState("");
  const [busy, setBusy] = useState(false);

  const payable = (licenses ?? []).filter((l: any) => !l.is_trial && !l.disabled_at);

  const check = async () => {
    setBusy(true);
    try {
      const res: any = await preview({ data: { code } });
      if (!res?.ok) {
        setInfo(null);
        toast.error(res?.message ?? "Código inválido.");
        return;
      }
      setInfo(res);
      if (res.needsLicense && payable.length === 1) setLicenseId(payable[0].id);
    } catch (e: any) {
      setInfo(null);
      toast.error(e?.message ?? "Não foi possível validar o código.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (info?.needsLicense && !licenseId) {
      toast.error("Escolha qual licença vai receber a renovação do servidor.");
      return;
    }
    setBusy(true);
    try {
      const res: any = await redeem({
        data: { code, ...(licenseId ? { licenseId } : {}) },
      });
      toast.success(res?.message ?? "Código aplicado!");
      setCode("");
      setInfo(null);
      setLicenseId("");
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível aplicar o código.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border/60 bg-background/40">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
            Resgatar código
          </h3>
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          Recebeu um código da equipe? Use aqui para liberar dias de licença ou adiantar a
          mensalidade do servidor até o próximo dia 20.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setInfo(null);
            }}
            placeholder="SHDW-XXXX-XXXX"
            className="font-mono uppercase"
          />
          <Button variant="outline" onClick={check} disabled={busy || code.trim().length < 4}>
            {busy && !info ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Ticket className="mr-1.5 h-3.5 w-3.5" />}
            Conferir
          </Button>
        </div>

        {info && (
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="font-mono text-[11px] text-foreground">{info.description}</div>

            {info.needsLicense && (
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Aplicar em qual licença?
                </label>
                <select
                  value={licenseId}
                  onChange={(e) => setLicenseId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-xs"
                >
                  <option value="">selecione…</option>
                  {payable.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {planLabel(l.plan_slug, l.is_trial)} · {l.yaarsa_email}
                    </option>
                  ))}
                </select>
                {payable.length === 0 && (
                  <p className="font-mono text-[10px] text-danger">
                    Você ainda não tem uma licença paga para receber a renovação.
                  </p>
                )}
              </div>
            )}

            <Button onClick={apply} disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Resgatar agora
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
